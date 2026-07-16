# 账号管理功能增强计划

> 本文档面向在当前 Label Studio 项目中**增强账号管理能力**的实施人员，给出从现状分析、目标设计、数据模型、接口、权限、前端到迁移测试的完整落地计划。
>
> - 目标读者：后端工程师、前端工程师、DBA、测试工程师
> - 适用版本：基于当前仓库 `c:\Users\yystj\work\label-studio\label-studio`
> - 配套文档：[../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md)（现有认证授权实现分析）、[../project/PROJECT.md](../project/PROJECT.md)（整体架构）

---

## 目录

1. [目标与范围](#1-目标与范围)
2. [现状分析](#2-现状分析)
3. [总体设计](#3-总体设计)
4. [数据模型设计](#4-数据模型设计)
5. [后端实现计划](#5-后端实现计划)
6. [权限模型设计](#6-权限模型设计)
7. [前端实现计划](#7-前端实现计划)
8. [迁移与兼容策略](#8-迁移与兼容策略)
9. [测试计划](#9-测试计划)
10. [里程碑与交付物](#10-里程碑与交付物)
11. [风险与对策](#11-风险与对策)

---

## 1. 目标与范围

### 1.1 业务目标

在当前项目内增加完整的账号管理能力，使管理员能够：

1. **账号增删改查**：在组织（公司）内创建、查询、修改、停用、删除账号
2. **账号加入公司**：将账号加入一个或多个公司（Organization），支持邀请、移除、切换
3. **项目级权限授予**：账号加入公司后，可获得该公司下属项目的「读取」或「编辑」权限，并可按项目粒度灵活分配
4. **角色与权限可视化**：在前端提供「成员管理」「项目成员」两类管理页面，清晰展示谁在哪个公司、谁对哪个项目有何种权限

### 1.2 范围界定

| 类别 | 包含 | 不包含 |
| --- | --- | --- |
| 账号管理 | User 的 CRUD、启用/停用、重置密码、重置 Token、加入/退出公司 | 单点登录（SSO）、LDAP、OAuth2 集成 |
| 公司管理 | Organization 成员的加入/移除/软删除、成员列表、邀请链接 | 公司本身的创建/删除（沿用现有逻辑） |
| 项目权限 | 项目级「读取」「编辑」两种权限的授予、撤销、查询 | 项目内对象级（Task/Annotation）细粒度权限 |
| 角色 | 组织级角色（Owner/Admin/Member）、项目级角色（Viewer/Editor） | 自定义角色、角色继承、权限模板 |
| 多租户 | 一个用户可加入多个公司，可切换 `active_organization` | 跨公司数据共享、公司间数据迁移 |

### 1.3 核心业务流程

```text
管理员登录 → 进入「公司成员」页 → 创建/邀请账号 → 账号加入公司
   ↓
账号登录 → 切换 active_organization → 看到公司内可见项目
   ↓
管理员进入「项目成员」页 → 为账号分配项目级「读取/编辑」权限
   ↓
账号进入项目 → 根据项目级权限决定是否可标注、是否可导出、是否可改配置
```

---

## 2. 现状分析

### 2.1 已具备的能力

经源码梳理（详见 [../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md)），当前项目已具备：

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 自定义用户模型 `User` | [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) | `htx_user` 表，邮箱登录，`active_organization` 字段 |
| 组织模型 `Organization` | [organizations/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py) | `organization` 表，`token` 邀请链接，`created_by` 一对一 |
| 组织成员 `OrganizationMember` | [organizations/models.py#L18](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py#L18) | 中间表，含 `deleted_at` 软删除，**无 role 字段**（OSS 已移除） |
| 项目成员 `ProjectMember` | [projects/models.py#L1396](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py#L1396) | `user`、`project`、`enabled`，**无 role 字段** |
| 用户 CRUD API | [users/api.py `UserAPI`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/api.py#L170) | `/api/users/` 提供 GET/POST/PATCH/DELETE，权限要求 `organizations_change` |
| 加入组织 | [organizations/models.py `Organization.add_user`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py#L140) | 创建 `OrganizationMember` |
| 移除组织成员 | [organizations/models.py `Organization.remove_user`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py#L151) | 物理删除 `OrganizationMember` 并切回 `active_organization` |
| 项目协作者 | [projects/models.py `Project.add_collaborator`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py#L479) | 创建 `ProjectMember`，仅 `enabled` 标记 |
| 权限定义中心 | [core/permissions.py `AllPermissions`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/permissions.py) | 40+ 权限常量，OSS 默认谓词为 `rules.is_authenticated` |
| DRF 权限类 | [core/api_permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/api_permissions.py) | `HasObjectPermission`、`MemberHasOwnerPermission` |
| 前端成员页 | [organizations/templates/organizations/people_list.html](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/templates/organizations/people_list.html) | Django 模板渲染的成员列表（旧 UI） |

### 2.2 主要差距

| 差距 | 影响 |
| --- | --- |
| `OrganizationMember` 无 `role` 字段 | OSS 中所有成员都被视为管理员（[users/models.py `is_organization_admin`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py#L179) 恒返回 `True`），无法区分 Owner/Admin/Member |
| `ProjectMember` 无 `role` 字段 | 无法区分项目级「读取/编辑」权限，所有人要么能看要么完全无权限 |
| 权限谓词过于宽松 | OSS 所有权限默认 `rules.is_authenticated`，即「登录即拥有」，无法做项目级细粒度控制 |
| 缺少项目级权限查询 API | 前端无法获知「当前用户在项目 X 上是 Viewer 还是 Editor」 |
| 前端缺少现代化的「项目成员管理」页面 | 现有 `people_list.html` 仅组织级，且为 Django 模板而非 React 组件 |
| 用户列表无分页/搜索 | `UserAPI.get_queryset` 仅按 `active_organization` 过滤，无分页、无搜索、无角色筛选 |

### 2.3 现有数据关系（增强前）

```text
htx_user (1) ──active_organization──> (N) organization
htx_user (N) <──OrganizationMember──> (N) organization   [软删除]
htx_user (N) <──ProjectMember──> (N) project              [仅 enabled]
organization (1) ──projects──> (N) project
```

---

## 3. 总体设计

### 3.1 设计原则

1. **最小侵入**：尽量复用现有 `Organization`、`ProjectMember`、`AllPermissions`，避免推倒重来
2. **OSS/LSE 兼容**：新增字段与逻辑通过 `settings.*_MIXIN`、`load_func` 留出扩展点，不破坏 Enterprise 扩展机制
3. **特性开关兜底**：新权限行为默认通过 `flag_set('feat_account_rbac')` 开关控制，灰度上线
4. **向后兼容**：迁移完成后，已存在的成员自动赋默认角色，不改变其现有可见性
5. **API 优先**：所有管理能力通过 REST API 暴露，前端只消费 API

### 3.2 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│                       前端（React）                          │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 公司成员管理页    │  │ 项目成员管理页    │                │
│  │ (PeoplePage)     │  │ (ProjectMembers) │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                          │
│           └──────────┬──────────┘                          │
│                      ▼                                     │
│            /api/users/  /api/organizations/{id}/members     │
│            /api/projects/{id}/members                       │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端（Django + DRF）                      │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │ users app       │  │ organizations app│                 │
│  │ - UserAPI       │  │ - OrgMemberAPI   │                 │
│  │ - UserSerializer│  │ - Role 字段      │                 │
│  └─────────────────┘  └──────────────────┘                 │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │ projects app    │  │ core/permissions │                 │
│  │ - ProjMemberAPI │  │ - 项目级谓词      │                 │
│  │ - Role 字段     │  │ - RBAC 校验      │                 │
│  └─────────────────┘  └──────────────────┘                 │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层（SQLite/PG）                       │
│  htx_user · organization · organization_member              │
│  project · project_member (+role) · organization_role       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 数据模型设计

### 4.1 组织级角色：扩展 `OrganizationMember`

在 `organization_member` 表增加 `role` 字段，复用早期迁移中已存在但被移除的角色概念。

```python
# label_studio/organizations/models.py（修改 OrganizationMember）
class OrganizationMember(OrganizationMemberMixin, models.Model):
    class Role(models.TextChoices):
        OWNER = 'OWNER', _('Owner')        # 创建者，唯一
        ADMIN = 'ADMIN', _('Administrator') # 可管理成员与项目
        MEMBER = 'MEMBER', _('Member')     # 仅可参与被分配的项目

    user = models.ForeignKey(...)
    organization = models.ForeignKey(...)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.MEMBER,
        help_text='角色：OWNER/ADMIN/MEMBER',
    )
    created_at = ...
    updated_at = ...
    deleted_at = ...
```

**迁移策略**：

- 新增字段时 `default=Role.MEMBER`
- 数据迁移中：将 `organization.created_by` 对应的 `OrganizationMember.role` 设为 `OWNER`
- 其余已存在成员设为 `MEMBER`（保守默认）
- 管理员可后续手动提升为 `ADMIN`

### 4.2 项目级角色：扩展 `ProjectMember`

在 `project_member` 表增加 `role` 字段与时间戳。

```python
# label_studio/projects/models.py（修改 ProjectMember）
class ProjectMember(models.Model):
    class Role(models.TextChoices):
        VIEWER = 'VIEWER', _('Viewer')   # 只读：查看任务、标注、导出
        EDITOR = 'EDITOR', _('Editor')   # 编辑：可创建/修改标注、上传任务

    user = models.ForeignKey(...)
    project = models.ForeignKey(...)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.VIEWER,
        help_text='项目角色：VIEWER 只读 / EDITOR 编辑',
    )
    enabled = models.BooleanField(default=True)
    created_at = ...
    updated_at = ...

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'project'], name='unique_project_member'),
        ]
        indexes = [
            models.Index(fields=['project', 'role']),
            models.Index(fields=['user', 'role']),
        ]
```

**迁移策略**：

- 新增字段 `default=Role.VIEWER`
- 数据迁移中：对已存在的 `ProjectMember` 设为 `EDITOR`（保持现有可编辑行为，避免回退）
- 组织 `ADMIN` 与 `OWNER` 自动获得所有项目 `EDITOR` 权限（在权限层推断，不写表）

### 4.3 账号扩展字段

在 `htx_user` 增加账号管理所需字段：

```python
# label_studio/users/models.py（User 增字段）
class User(AbstractUser):
    ...
    is_active_account = models.BooleanField(
        default=True, help_text='账号是否启用（与 is_active 区分：is_active 用于 Django auth，is_active_account 用于业务层停用）'
    )
    last_admin_action_at = models.DateTimeField(null=True, blank=True, help_text='最近管理员操作时间（审计）')
    notes = models.TextField(blank=True, default='', help_text='管理员备注')
```

> 说明：`is_active` 是 Django 内置字段，停用会影响登录。为避免与 Django auth 冲突，新增 `is_active_account` 作为业务层「停用账号」标志，登录时一并校验。

### 4.4 ER 关系（增强后）

```text
┌─────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  htx_user   │ 1───N  │ organization_member  │  N───1 │ organization │
│ - id        │◄──────►│ - user_id            │◄──────►│ - id         │
│ - email     │        │ - organization_id    │        │ - title      │
│ - is_active │        │ - role (NEW)         │        │ - created_by │
│ - is_active │        │ - deleted_at         │        └──────┬───────┘
│   _account  │        └──────────────────────┘               │
│   (NEW)     │                                           projects
│ - notes(NEW)│                                               │
└──────┬──────┘                                               ▼
       │ 1                                            ┌──────────────┐
       │ N                                            │   project    │
       │                                              │ - id         │
       │ 1───N  ┌──────────────────────┐  N───1       │ - org_id     │
       │◄──────►│   project_member     │◄──────►      │ - title      │
       │        │ - user_id            │              └──────────────┘
       │        │ - project_id         │
       │        │ - role (NEW)         │
       │        │ - enabled            │
       │        └──────────────────────┘
       │
       │ 1
       ▼
┌─────────────────┐
│ authtoken_token │  DRF Token（已存在）
└─────────────────┘
```

### 4.5 索引与约束

| 表 | 新增索引 | 用途 |
| --- | --- | --- |
| `organization_member` | `(organization_id, role)` | 按公司查某角色成员 |
| `organization_member` | `(user_id, role)` | 查某用户在各公司的角色 |
| `project_member` | `(project_id, role)` | 按项目查某角色成员 |
| `project_member` | `(user_id, role)` | 查某用户的项目角色 |
| `project_member` | UniqueConstraint `(user, project)` | 防重复 |

---

## 5. 后端实现计划

### 5.1 新增/修改的文件清单

| 文件 | 类型 | 改动 |
| --- | --- | --- |
| [organizations/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py) | 修改 | `OrganizationMember` 增加 `role` 字段、`Role` 枚举 |
| [organizations/migrations/0007_member_role.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/migrations) | 新增 | 加字段 + 数据迁移（标记 OWNER） |
| [organizations/serializers.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/serializers.py) | 修改 | 序列化 `role` |
| [organizations/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/api.py) | 修改 | 新增 `OrganizationMemberAPI`（CRUD + 角色变更） |
| [organizations/urls.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/urls.py) | 修改 | 注册新路由 |
| [projects/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py) | 修改 | `ProjectMember` 增加 `role` 字段、`Role` 枚举、约束 |
| [projects/migrations/00XX_project_member_role.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/migrations) | 新增 | 加字段 + 数据迁移 |
| [projects/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/api.py) | 修改 | 新增 `ProjectMemberAPI` |
| [projects/serializers.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/serializers.py) | 修改 | `ProjectMemberSerializer` |
| [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) | 修改 | 增 `is_active_account`、`notes`、`last_admin_action_at`；改 `is_organization_admin` 用 `role` 判断 |
| [users/migrations/0012_account_fields.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/migrations) | 新增 | 加字段 |
| [users/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/api.py) | 修改 | `UserAPI` 增分页/搜索/角色筛选；新增停用接口 |
| [users/serializers.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/serializers.py) | 修改 | 序列化新字段 |
| [users/views.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/views.py) | 修改 | 登录校验 `is_active_account` |
| [core/permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/permissions.py) | 修改 | 新增项目级权限常量；为现有权限注册项目级谓词 |
| [core/api_permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/api_permissions.py) | 修改 | 新增 `HasProjectRolePermission` |
| [core/feature_flags.json](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/feature_flags.json) | 修改 | 新增 `feat_account_rbac` 开关 |

### 5.2 API 设计

#### 5.2.1 账号 CRUD（增强现有 `/api/users/`）

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/users/?page=&search=&role=&is_active_account=` | `organizations_view` | 分页、搜索、按角色/状态筛选 |
| POST | `/api/users/` | `organizations_change` | 创建账号并加入当前组织（指定初始 role） |
| GET | `/api/users/{id}/` | `organizations_view` | 查看详情（含组织角色、项目角色概要） |
| PATCH | `/api/users/{id}/` | `organizations_change` | 修改姓名、电话、备注 |
| DELETE | `/api/users/{id}/` | `organizations_change` | 软删除（从组织移除） |
| POST | `/api/users/{id}/disable/` | `organizations_change` | 停用账号（`is_active_account=False`） |
| POST | `/api/users/{id}/enable/` | `organizations_change` | 启用账号 |
| POST | `/api/users/{id}/reset-password/` | `organizations_change` | 管理员重置密码（生成临时密码或发送邮件） |
| POST | `/api/users/{id}/reset-token/` | `organizations_change` | 重置 API Token |

请求示例（创建账号）：

```json
POST /api/users/
{
  "email": "annotator@example.com",
  "first_name": "张",
  "last_name": "三",
  "password": "********",
  "organization_role": "MEMBER"
}
```

响应：

```json
{
  "id": 42,
  "email": "annotator@example.com",
  "first_name": "张",
  "last_name": "三",
  "is_active_account": true,
  "organization_role": "MEMBER",
  "project_memberships": [],
  "created_at": "2026-07-13T10:00:00Z"
}
```

#### 5.2.2 组织成员管理 `/api/organizations/{org_id}/members/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/organizations/{org_id}/members/` | `organizations_view` | 列出成员（含 role、joined_at） |
| POST | `/api/organizations/{org_id}/members/` | `organizations_change` | 将已存在账号加入组织（支持指定 role） |
| PATCH | `/api/organizations/{org_id}/members/{user_id}/` | `organizations_change` | 修改成员角色 |
| DELETE | `/api/organizations/{org_id}/members/{user_id}/` | `organizations_change` | 软删除成员（`deleted_at`） |
| POST | `/api/organizations/{org_id}/invite-link/` | `organizations_change` | 重置邀请链接（`token`） |

请求示例（加入组织）：

```json
POST /api/organizations/1/members/
{
  "email": "existing@example.com",
  "role": "MEMBER"
}
```

> 备注：若该邮箱账号不存在，返回 404 并提示管理员先创建账号或使用邀请链接。

#### 5.2.3 项目成员管理 `/api/projects/{project_id}/members/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/projects/{project_id}/members/` | `projects_view` | 列出项目成员（含 role） |
| POST | `/api/projects/{project_id}/members/` | `projects_change` | 添加成员（指定 VIEWER/EDITOR） |
| PATCH | `/api/projects/{project_id}/members/{user_id}/` | `projects_change` | 修改成员角色 |
| DELETE | `/api/projects/{project_id}/members/{user_id}/` | `projects_change` | 移除成员 |
| GET | `/api/projects/{project_id}/members/me/` | `IsAuthenticated` | 查询当前用户在该项目的角色（前端用） |

请求示例（添加项目成员）：

```json
POST /api/projects/10/members/
{
  "user_id": 42,
  "role": "EDITOR"
}
```

响应示例（`/members/me/`）：

```json
{
  "user_id": 42,
  "project_id": 10,
  "role": "EDITOR",
  "can_view": true,
  "can_edit": true,
  "can_manage": false
}
```

#### 5.2.4 批量操作（可选，二期）

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| POST | `/api/projects/{project_id}/members/bulk/` | 批量添加/修改成员 |
| POST | `/api/organizations/{org_id}/members/bulk-disable/` | 批量停用 |

### 5.3 序列化器设计

```python
# label_studio/users/serializers.py
class UserDetailSerializer(BaseUserSerializer):
    organization_role = serializers.SerializerMethodField()
    project_memberships = serializers.SerializerMethodField()
    is_active_account = serializers.BooleanField()

    def get_organization_role(self, obj):
        member = OrganizationMember.objects.filter(
            user=obj, organization=obj.active_organization, deleted_at__isnull=True
        ).first()
        return member.role if member else None

    def get_project_memberships(self, obj):
        return ProjectMember.objects.filter(user=obj, project__organization=obj.active_organization).values(
            'project_id', 'role', 'enabled'
        )

# label_studio/projects/serializers.py
class ProjectMemberSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['user_id', 'email', 'first_name', 'last_name', 'project', 'role', 'enabled', 'created_at']
        read_only_fields = ['project', 'created_at']
```

---

## 6. 权限模型设计

### 6.1 角色与权限映射

#### 6.1.1 组织级角色权限

| 权限/动作 | OWNER | ADMIN | MEMBER |
| --- | --- | --- | --- |
| 查看组织成员列表 | ✓ | ✓ | ✗（仅看自己） |
| 邀请/移除成员 | ✓ | ✓ | ✗ |
| 修改成员角色 | ✓ | ✓（不能改 OWNER） | ✗ |
| 创建/删除项目 | ✓ | ✓ | ✗ |
| 修改组织设置（JWT/会话策略） | ✓ | ✓ | ✗ |
| 删除组织 | ✓ | ✗ | ✗ |
| 重置邀请链接 | ✓ | ✓ | ✗ |
| 加入项目（被分配） | ✓ | ✓ | ✓ |

#### 6.1.2 项目级角色权限

| 权限/动作 | VIEWER | EDITOR | （组织 ADMIN/OWNER 自动视为 EDITOR + manage） |
| --- | --- | --- | --- |
| 查看项目（列表/详情） | ✓ | ✓ | ✓ |
| 查看任务列表 | ✓ | ✓ | ✓ |
| 查看标注 | ✓ | ✓ | ✓ |
| 导出数据 | ✓ | ✓ | ✓ |
| 创建/修改标注 | ✗ | ✓ | ✓ |
| 创建/修改任务 | ✗ | ✓ | ✓ |
| 删除标注 | ✗ | ✓ | ✓ |
| 修改项目配置（label_config） | ✗ | ✗ | ✓（仅 ADMIN/OWNER） |
| 管理 Webhook/ML Backend | ✗ | ✗ | ✓（仅 ADMIN/OWNER） |
| 管理项目成员 | ✗ | ✗ | ✓（仅 ADMIN/OWNER） |
| 删除项目 | ✗ | ✗ | ✓（仅 OWNER） |

### 6.2 权限谓词实现

在 [core/permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/permissions.py) 新增项目级权限常量：

```python
class AllPermissions(BaseModel):
    # ... 现有权限 ...
    projects_view = 'projects.view'
    projects_change = 'projects.change'
    projects_delete = 'projects.delete'
    projects_manage_members = 'projects.manage_members'
    tasks_create = 'tasks.create'
    tasks_change = 'tasks.change'
    tasks_delete = 'tasks.delete'
    annotations_create = 'annotations.create'
    annotations_change = 'annotations.change'
    annotations_delete = 'annotations.delete'
    # ...
```

在新建的 `core/project_rules.py` 中注册谓词：

```python
# label_studio/core/project_rules.py
import rules
from projects.models import ProjectMember

@rules.predicate
def is_project_member(user, project):
    if not user.is_authenticated or project is None:
        return False
    return ProjectMember.objects.filter(
        user=user, project=project, enabled=True
    ).exists()

@rules.predicate
def is_project_editor(user, project):
    if not user.is_authenticated or project is None:
        return False
    return ProjectMember.objects.filter(
        user=user, project=project, enabled=True, role=ProjectMember.Role.EDITOR
    ).exists()

@rules.predicate
def is_org_admin(user, project):
    if not user.is_authenticated or project is None:
        return False
    from organizations.models import OrganizationMember
    return OrganizationMember.objects.filter(
        user=user, organization=project.organization_id,
        deleted_at__isnull=True,
        role__in=[OrganizationMember.Role.OWNER, OrganizationMember.Role.ADMIN],
    ).exists()

# 组合谓词
rules.add_perm('projects.view', is_project_member | is_org_admin)
rules.add_perm('projects.change', is_project_editor | is_org_admin)
rules.add_perm('projects.manage_members', is_org_admin)
rules.add_perm('tasks.create', is_project_editor | is_org_admin)
rules.add_perm('tasks.change', is_project_editor | is_org_admin)
rules.add_perm('annotations.create', is_project_editor | is_org_admin)
rules.add_perm('annotations.change', is_project_editor | is_org_admin)
rules.add_perm('annotations.delete', is_project_editor | is_org_admin)
```

### 6.3 DRF 权限类

```python
# label_studio/core/api_permissions.py
class HasProjectRolePermission(permissions.BasePermission):
    """
    项目级角色权限校验：
    - 从 URL 中解析 project_pk
    - 根据视图声明的 permission_required 查询所需权限
    - 通过 rules 谓词校验
    """
    def has_permission(self, request, view):
        project_pk = view.kwargs.get('project_pk') or view.kwargs.get('pk')
        if not project_pk:
            return False
        try:
            project = Project.objects.get(pk=project_pk)
        except Project.DoesNotExist:
            return False
        required = view.permission_required_map.get(request.method, 'projects.view')
        return request.user.has_perm(required, project)
```

### 6.4 特性开关

新增 `feat_account_rbac` 特性开关：

- 关闭时（默认上线初期）：保留旧行为（登录即拥有所有权限）
- 开启时：启用项目级 RBAC 校验

在 [core/feature_flags.json](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/feature_flags.json) 中新增：

```json
{
  "feat_account_rbac": {
    "type": "bool",
    "default": false,
    "description": "启用账号管理 RBAC（组织级 + 项目级角色）"
  }
}
```

权限校验入口统一封装：

```python
# label_studio/core/rbac.py
from core.feature_flags import flag_set

def check_project_perm(user, perm, project):
    if not flag_set('feat_account_rbac'):
        return user.is_authenticated  # 旧行为
    return user.has_perm(perm, project)
```

### 6.5 `is_organization_admin` 改造

[users/models.py#L179](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py#L179) 的 `is_organization_admin` 改为：

```python
@cached_property
def is_organization_admin(self):
    if not flag_set('feat_account_rbac'):
        return True  # 兼容旧行为
    member = OrganizationMember.objects.filter(
        user=self, organization=self.active_organization,
        deleted_at__isnull=True,
        role__in=[OrganizationMember.Role.OWNER, OrganizationMember.Role.ADMIN],
    ).first()
    return member is not None
```

---

## 7. 前端实现计划

### 7.1 路由与页面结构

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/organization/people` | `PeoplePage`（重构） | 公司成员管理（React） |
| `/projects/{id}/settings/members` | `ProjectMembersPage`（新增） | 项目成员管理 |
| `/user/account` | `AccountPage`（增强） | 个人账号信息（已存在） |

### 7.2 公司成员管理页 `PeoplePage`

**位置**：`web/apps/labelstudio/src/pages/Organization/People/`

**功能**：

1. 成员列表表格（分页、搜索、按角色/状态筛选）
   - 列：头像、姓名、邮箱、角色（OWNER/ADMIN/MEMBER）、状态（启用/停用）、加入时间、操作
2. 「邀请成员」按钮 → 弹窗输入邮箱、选择角色
3. 行操作：修改角色、停用/启用、重置密码、重置 Token、移除
4. 「重置邀请链接」按钮（生成可分享的注册链接）
5. 权限控制：仅 OWNER/ADMIN 可见此页；MEMBER 只能看成员列表，无操作按钮

**组件结构**：

```text
PeoplePage/
├── index.tsx                    # 主页面（Jotai 状态 + 数据获取）
├── people-table.tsx             # 成员表格
├── invite-member-modal.tsx      # 邀请弹窗
├── edit-role-menu.tsx           # 角色变更菜单
├── reset-link-button.tsx        # 重置邀请链接
└── people-page.module.css
```

### 7.3 项目成员管理页 `ProjectMembersPage`

**位置**：`web/apps/labelstudio/src/pages/Project/Settings/Members/`

**功能**：

1. 项目成员列表（角色 VIEWER/EDITOR）
2. 「添加成员」按钮 → 弹窗从组织成员中选择，指定角色
3. 行操作：修改角色、移除
4. 显示「组织 ADMIN/OWNER 自动获得 EDITOR 权限」提示
5. 权限控制：仅组织 ADMIN/OWNER 可见

**组件结构**：

```text
Members/
├── index.tsx
├── members-table.tsx
├── add-member-modal.tsx         # 从组织成员中选
└── members.module.css
```

### 7.4 状态管理

使用 Jotai atoms（遵循 [.cursor/rules/react.mdc](file:///c:/Users/yystj/work/label-studio/label-studio/.cursor/rules/react.mdc)）：

```typescript
// web/apps/labelstudio/src/store/org-members.ts
import { atomWithQuery } from 'jotai-tanstack-query'

export const orgMembersAtom = atomWithQuery(() => ({
  queryKey: ['org-members'],
  queryFn: () => api.listOrgMembers(),
}))

export const projectMembersAtom = (projectId: number) =>
  atomWithQuery(() => ({
    queryKey: ['project-members', projectId],
    queryFn: () => api.listProjectMembers(projectId),
  }))
```

### 7.5 API 客户端

在 `web/libs/app-common` 中扩展 API provider：

```typescript
// web/libs/app-common/src/api/account-management.ts
export const accountManagementApi = {
  listUsers: (params: { page?: number; search?: string; role?: string }) =>
    http.get('/api/users/', { params }),
  createUser: (data: CreateUserPayload) => http.post('/api/users/', data),
  disableUser: (userId: number) => http.post(`/api/users/${userId}/disable/`),
  resetUserPassword: (userId: number) => http.post(`/api/users/${userId}/reset-password/`),
  listOrgMembers: (orgId: number) => http.get(`/api/organizations/${orgId}/members/`),
  addOrgMember: (orgId: number, data: { email: string; role: string }) =>
    http.post(`/api/organizations/${orgId}/members/`, data),
  updateOrgMemberRole: (orgId: number, userId: number, role: string) =>
    http.patch(`/api/organizations/${orgId}/members/${userId}/`, { role }),
  removeOrgMember: (orgId: number, userId: number) =>
    http.delete(`/api/organizations/${orgId}/members/${userId}/`),
  listProjectMembers: (projectId: number) => http.get(`/api/projects/${projectId}/members/`),
  addProjectMember: (projectId: number, data: { user_id: number; role: string }) =>
    http.post(`/api/projects/${projectId}/members/`, data),
  updateProjectMemberRole: (projectId: number, userId: number, role: string) =>
    http.patch(`/api/projects/${projectId}/members/${userId}/`, { role }),
  removeProjectMember: (projectId: number, userId: number) =>
    http.delete(`/api/projects/${projectId}/members/${userId}/`),
  getMyProjectRole: (projectId: number) => http.get(`/api/projects/${projectId}/members/me/`),
}
```

### 7.6 前端权限控制

复用 `WhoAmIUserSerializer` 返回的 `permissions` 列表，在前端按权限字符串控制按钮可见性：

```typescript
const canManageOrg = useAtomValue(currentUserAtom)?.permissions.includes('organizations_change')
const canManageProject = useAtomValue(currentUserAtom)?.permissions.includes('projects_change')
```

项目内操作（如「开始标注」按钮）调用 `/api/projects/{id}/members/me/` 获取角色，决定是否禁用。

---

## 8. 迁移与兼容策略

### 8.1 数据库迁移顺序

1. **Step 1**：`organizations` 加 `role` 字段（`default='MEMBER'`）
2. **Step 2**：数据迁移 — 将 `organization.created_by` 对应成员标记为 `OWNER`
3. **Step 3**：`projects` 加 `project_member.role` 字段（`default='VIEWER'`）
4. **Step 4**：数据迁移 — 已存在 `ProjectMember` 设为 `EDITOR`（保持兼容）
5. **Step 5**：`users` 加 `is_active_account`、`notes`、`last_admin_action_at`
6. **Step 6**：数据迁移 — 所有用户 `is_active_account = is_active`

> 所有迁移必须同时支持 SQLite 与 PostgreSQL，参见 [.cursor/rules/async_migrations.mdc](file:///c:/Users/yystj/work/label-studio/label-studio/.cursor/rules/async_migrations.mdc)。本批迁移均为加字段（小数据量），无需异步。

### 8.2 灰度发布策略

1. **阶段 1（默认关闭）**：合并代码，`feat_account_rbac=False`，仅数据库迁移生效，权限行为不变
2. **阶段 2（部分开启）**：在测试组织开启开关，验证 RBAC 校验
3. **阶段 3（全量开启）**：所有组织开启，旧 `is_organization_admin` 改用 `role` 判断
4. **阶段 4（清理）**：稳定后移除特性开关判断分支

### 8.3 兼容性保证

| 场景 | 兼容措施 |
| --- | --- |
| 旧客户端调用 `/api/users/` | 响应保留旧字段，新增字段为可选 |
| 现有 `OrganizationMember` 无 role | 迁移时统一赋 `MEMBER` |
| 现有 `ProjectMember` 无 role | 迁移时统一赋 `EDITOR`（保持可编辑） |
| Enterprise 扩展 | 通过 `settings.ORGANIZATION_MEMBER_MIXIN`、`settings.PROJECT_MIXIN` 保留扩展点 |
| 特性开关关闭时 | 所有权限谓词走旧逻辑（`is_authenticated`） |

---

## 9. 测试计划

### 9.1 后端单元测试

| 测试文件 | 覆盖范围 |
| --- | --- |
| `organizations/tests/test_member_role.py`（新增） | `OrganizationMember.role` 字段、`is_organization_admin` 改造 |
| `organizations/tests/test_api.py`（扩展） | 成员 CRUD API、角色变更、权限校验 |
| `projects/tests/test_project_member.py`（新增） | `ProjectMember.role`、`add_collaborator` 兼容 |
| `projects/tests/test_api.py`（扩展） | 项目成员 API、权限校验 |
| `users/tests/test_account_fields.py`（新增） | `is_active_account`、停用账号无法登录 |
| `core/tests/test_project_rules.py`（新增） | 项目级权限谓词（VIEWER/EDITOR/ADMIN） |
| `core/tests/test_rbac_flag.py`（新增） | 特性开关开启/关闭的行为差异 |

### 9.2 集成测试场景

1. **创建账号 → 加入组织 → 分配项目 → 标注**
   - 创建 MEMBER 账号 → 不分配项目 → 访问项目返回 403
   - 分配 VIEWER 角色 → 可查看任务列表，提交标注返回 403
   - 升级为 EDITOR → 可提交标注
2. **组织成员管理**
   - ADMIN 邀请新成员 → 新成员收到邀请链接 → 注册成功
   - ADMIN 修改成员角色为 MEMBER → 该成员失去管理能力
   - OWNER 移除 ADMIN → ADMIN 立即失去访问
3. **多组织切换**
   - 用户加入两个组织 → 切换 `active_organization` → 看到不同项目列表
4. **停用账号**
   - 停用账号 → 该账号再次登录返回 401/403
   - 已签发的 Token 立即失效（在 `TokenAuthenticationPhaseout` 中校验 `is_active_account`）
5. **特性开关**
   - 关闭开关时，VIEWER 也能提交标注（旧行为）
   - 开启开关后，VIEWER 提交返回 403

### 9.3 前端测试

- 组件单元测试：`PeoplePage`、`ProjectMembersPage`、弹窗组件
- E2E（Cypress）：邀请成员 → 加入组织 → 分配项目 → 标注 的全流程

### 9.4 性能测试

- `/api/users/?page=1&search=` 在 1000 成员组织下的响应时间应 < 500ms
- 项目级权限谓词在 100 个项目 × 100 成员规模下的查询性能（验证索引有效性）

---

## 10. 里程碑与交付物

### 10.1 里程碑划分

| 里程碑 | 内容 | 交付物 |
| --- | --- | --- |
| M1：数据模型 | 数据库迁移、模型字段、序列化器 | 迁移文件、模型代码、单元测试 |
| M2：后端 API | 用户/组织成员/项目成员 API、权限谓词 | API 代码、`core/project_rules.py`、API 测试 |
| M3：前端页面 | `PeoplePage` 重构、`ProjectMembersPage` 新增 | React 组件、E2E 测试 |
| M4：灰度上线 | 特性开关、文档、监控 | 部署文档、监控面板 |
| M5：全量发布 | 移除开关、清理旧代码 | 最终版本 |

### 10.2 交付物清单

1. 后端代码（按 [5.1](#51-新增修改的文件清单) 文件清单）
2. 前端代码（按 [7.2](#72-公司成员管理页-peoplepage)、[7.3](#73-项目成员管理页-projectmemberspage) 结构）
3. 数据库迁移文件（6 个）
4. 单元测试 + 集成测试 + E2E 测试
5. API 文档（Swagger 自动生成，确保 drf-spectacular schema 完整）
6. 用户操作手册（管理员视角）

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Enterprise 版本已实现类似 RBAC，可能与本计划冲突 | 重复造轮子、合并冲突 | 在 OSS 实现时保留 `MIXIN` 扩展点；与 LSE 团队对齐字段命名 |
| 现有 `is_organization_admin=True` 被业务代码广泛依赖 | 改造后行为变化导致 bug | 全局搜索 `is_organization_admin` 调用点；通过特性开关逐步切换 |
| 大组织成员列表性能瓶颈 | API 响应慢 | 引入分页、`select_related`、Redis 缓存成员角色 |
| 软删除成员后 `active_organization` 失效 | 用户登录后看不到任何组织 | 在 `Organization.remove_user` 中已处理；增加登录时校验 |
| 项目级权限校验增加请求耗时 | 每个 API 多一次 DB 查询 | 用 `cached_property` 缓存请求级角色；批量查询时用 `prefetch_related` |
| 已签发 Token 的停用账号仍可访问 | 安全漏洞 | 在 `TokenAuthenticationPhaseout.authenticate` 中校验 `is_active_account` |
| 数据迁移失败回滚 | 数据不一致 | 迁移文件用 `atomic = True`（小数据量）；备份生产库 |

---

## 附：参考文件索引

| 主题 | 文件 |
| --- | --- |
| 现有认证授权分析 | [../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md) |
| 用户模型 | [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) |
| 用户 API | [users/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/api.py) |
| 组织模型 | [organizations/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py) |
| 组织 API | [organizations/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/api.py) |
| 项目模型 | [projects/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py) |
| 项目 API | [projects/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/api.py) |
| 权限定义 | [core/permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/permissions.py) |
| DRF 权限类 | [core/api_permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/api_permissions.py) |
| 特性开关 | [core/feature_flags](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/feature_flags) |
| 项目整体架构 | [../project/PROJECT.md](../project/PROJECT.md) |
