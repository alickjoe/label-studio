# 身份验证 OAuth2 改造计划

> 本文档面向将当前 Label Studio 身份验证体系**改造为 OAuth2 方式**的实施人员，给出从现状分析、选型推荐、架构设计、数据模型、后端实现、账号管理方案、前端集成、迁移测试到里程碑的完整落地计划。
>
> - 目标读者：后端工程师、前端工程师、运维工程师、安全工程师
> - 适用版本：基于当前仓库 `c:\Users\yystj\work\label-studio\label-studio`
> - 配套文档：[../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md)（现有认证授权分析）、[../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md)（账号与权限管理计划）

---

## 目录

1. [目标与范围](#1-目标与范围)
2. [现状分析](#2-现状分析)
3. [OAuth2 方案选型](#3-oauth2-方案选型)
4. [总体设计](#4-总体设计)
5. [数据模型设计](#5-数据模型设计)
6. [后端实现计划](#6-后端实现计划)
7. [账号管理方案](#7-账号管理方案)
8. [前端实现计划](#8-前端实现计划)
9. [安全设计](#9-安全设计)
10. [迁移与兼容策略](#10-迁移与兼容策略)
11. [测试计划](#11-测试计划)
12. [里程碑与交付物](#12-里程碑与交付物)
13. [风险与对策](#13-风险与对策)

---

## 1. 目标与范围

### 1.1 业务目标

将当前项目的身份验证改造为 OAuth2 方式，同时保证**账号管理（CRUD）与权限管理仍在项目内本地进行**。具体目标：

1. **身份验证外置**：用户登录时跳转到外部 OAuth2 身份提供商（IdP，如 Keycloak、Auth0、Google、GitHub、Azure AD 等），由 IdP 完成身份核验
2. **账号本地管理**：OAuth2 仅负责「证明你是谁」，账号的创建、查询、修改、停用、删除仍在 Label Studio 内由管理员管理
3. **权限本地管理**：用户的组织角色、项目角色、权限分配完全在 Label Studio 内管理（详见 [../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md)）
4. **多 IdP 支持**：可同时配置多个 OAuth2 提供商，用户选择任一登录
5. **账号关联**：一个本地账号可关联多个 OAuth2 身份（如同时绑定 Google 与 GitHub）
6. **平滑迁移**：现有本地密码登录在过渡期保留，最终可禁用

### 1.2 范围界定

| 类别 | 包含 | 不包含 |
| --- | --- | --- |
| 身份验证 | OAuth2 Authorization Code 流程、PKCE、单点登录（SSO） | OIDC 完整协议（ID Token 解析仅取 sub/email/name） |
| IdP 支持 | 通用 OAuth2、Keycloak、Google、GitHub、Azure AD、Auth0 | SAML、LDAP、CAS |
| 账号管理 | 本地 User CRUD、启用/停用、账号关联/解绑 | 在 IdP 侧创建/删除账号（反向 provisioning） |
| 权限管理 | 组织角色、项目角色、权限分配（沿用现有体系） | OAuth2 scope 映射为细粒度权限 |
| Token 管理 | 本地 Session、本地产出的 JWT/DRF Token | 透传 IdP 的 access_token 给前端 |
| 服务账号 | 保留 DRF Token / JWT 用于 API 调用 | 服务账号走 OAuth2 client_credentials |
| 用户 provisioning | JIT（Just-In-Time）首次登录自动创建本地账号 | SCIM 协议、IdP 主动推送用户 |

### 1.3 核心原则

> **身份验证（Authentication）外置，授权（Authorization）内置。**

```text
┌─────────────────┐     OAuth2      ┌─────────────────┐
│   外部 IdP       │ ◄─────────────► │  Label Studio   │
│  (Keycloak等)    │   身份核验       │                 │
│  - 用户密码存储  │                 │  - 账号 CRUD    │
│  - MFA           │                 │  - 角色与权限    │
│  - 密码策略      │                 │  - 组织/项目成员 │
└─────────────────┘                  │  - 会话管理     │
                                     └─────────────────┘
```

### 1.4 核心业务流程

```text
用户访问 LS → 未登录 → 重定向到 IdP 登录页 → 用户输入凭证 → IdP 回调 LS
   ↓
LS 用 authorization_code 换 access_token → 获取用户信息（sub/email/name）
   ↓
按 sub 查找本地 UserSocialAuth → 命中：登录该 User
   ↓ 未命中
按 email 查找本地 User → 命中：创建 UserSocialAuth 关联，登录
   ↓ 未命中
JIT 创建本地 User（默认角色 MEMBER）→ 创建 UserSocialAuth → 登录
   ↓
建立本地 Session → 后续请求走本地 Session/JWT/Token
   ↓
权限校验完全在本地（按 OrganizationMember.role / ProjectMember.role）
```

---

## 2. 现状分析

### 2.1 已具备的能力

经源码梳理（详见 [../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md)），当前身份验证体系为「会话 + Token + JWT」三层并存：

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 自定义用户模型 `User` | [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) | `htx_user` 表，`USERNAME_FIELD = 'email'`，本地密码哈希 |
| 用户管理器 | [users/models.py `UserManager`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py#L31) | `create_user`、`create_superuser`，`set_password()` 写入本地密码 |
| 会话认证 | Django `SessionAuthentication` | 依赖 `sessionid` Cookie |
| 登录视图 | [users/views.py `user_login`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/views.py#L103) | 表单登录，邮箱+密码 |
| 注册视图 | [users/views.py `user_signup`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/views.py#L40) | 表单注册，`proceed_registration` → `save_user` |
| 注册保存 | [users/functions/common.py `save_user`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/functions/common.py#L58) | 创建 User + 加入 Organization + 设置 `active_organization` |
| DRF Token | [jwt_auth/auth.py `TokenAuthenticationPhaseout`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/auth.py#L10) | `Authorization: Token <key>`，自动生成 |
| JWT Bearer | [jwt_auth/middleware.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/middleware.py) | `Authorization: Bearer xxx.xxx.xxx`，组织级开关 |
| JWT 模型 | [jwt_auth/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/models.py) | `JWTSettings`（组织级）、`LSAPIToken`、`LSTokenBackend` |
| Token 自动生成 | [users/models.py `init_user`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py#L243) | `post_save` 信号创建 DRF Token |
| 认证后端 | [core/settings/base.py:311](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py#L311) | `ObjectPermissionBackend` + `ModelBackend` |
| 会话超时 | [session_policy/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/session_policy/models.py) | 组织级 `SessionTimeoutPolicy` |
| X-Api-Key | [core/middleware.py `XApiKeySupportMiddleware`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/middleware.py) | 头改写为 `Authorization: Token` |
| 密码策略 | [core/settings/base.py:319](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py#L319) | `AUTH_PASSWORD_VALIDATORS` |

### 2.2 主要差距

| 差距 | 影响 |
| --- | --- |
| 无 OAuth2 客户端集成 | 无法对接外部 IdP，所有用户必须在 LS 内注册并存储密码 |
| 无 `UserSocialAuth` 等关联模型 | 无法记录「本地 User ↔ OAuth2 身份」的映射 |
| 登录页硬编码表单 | 无法插入「使用 X 登录」按钮、无法重定向到 IdP |
| `User.password` 为必填 | OAuth2 用户无密码，需改为可选 |
| `UserManager.create_user` 强制 `set_password` | OAuth2 用户创建路径需绕过密码 |
| 无 IdP 配置管理 | 无法在 UI 上配置多个 OAuth2 提供商 |
| 无 JIT provisioning | 首次 OAuth2 登录的用户无法自动创建本地账号 |
| 无账号关联/解绑 UI | 用户无法自助绑定多个 OAuth2 身份 |
| 无 SLO（单点登出） | 登出 LS 时不会通知 IdP |

### 2.3 现有认证流程

```text
浏览器 ──POST /user/login/ (email+password)──> Django auth.login → sessionid Cookie
浏览器 ──Authorization: Token xxx──> DRF TokenAuthenticationPhaseout → user
浏览器 ──Authorization: Bearer xxx.xxx.xxx──> JWTAuthenticationMiddleware → user
```

---

## 3. OAuth2 方案选型

### 3.1 候选库对比

| 方案 | 描述 | 优点 | 缺点 | 推荐度 |
| --- | --- | --- | --- | --- |
| A. **social-django**（python-social-auth） | 成熟的多后端社交认证库，支持 50+ 提供商 | 生态成熟、配置简单、支持自定义后端、JIT 创建用户、账号关联 | 维护节奏放缓，但稳定 | ★★★★★ |
| B. **django-allauth** | 另一主流社交认证库 | 模板与视图完善、文档好 | 配置略繁琐、与 DRF 集成需额外适配 | ★★★★ |
| C. **django-oauth-toolkit** | OAuth2 提供商库（LS 作为 IdP） | 功能完整 | **方向错误**：用户希望 LS 作为客户端而非提供商 | ★ |
| D. **自研 OAuth2 客户端** | 自己实现 Authorization Code 流程 | 完全可控 | 工作量大、安全风险高、重复造轮子 | ★ |

### 3.2 推荐：方案 A — social-django（python-social-auth）

**理由**：

1. **定位匹配**：social-django 正是「LS 作为 OAuth2 客户端，对接外部 IdP」的场景
2. **多提供商支持**：内置 Google、GitHub、GitLab、Azure AD、Keycloak（通过 `OAuth2` 通用后端）、Auth0 等
3. **JIT 用户创建**：`SOCIAL_AUTH_NEW_USER_REDIRECT`、`create_user` pipeline 自动创建本地 User
4. **账号关联**：内置 `UserSocialAuth` 模型，支持一个 User 关联多个 OAuth2 身份
5. **与 Django auth 深度集成**：复用 `AUTHENTICATION_BACKENDS`、`login()`、Session
6. **Pipeline 可扩展**：用户创建/登录的每一步都是可插拔的 pipeline 函数，便于定制「按 email 关联现有账号」「设置默认组织角色」等逻辑
7. **稳定**：虽更新不频繁，但 API 稳定、社区仍维护

### 3.3 备选：方案 B — django-allauth

若团队偏好更现代的库，可选 django-allauth。其与 social-django 能力相当，但模板与视图更完善。本计划以 social-django 为主，关键差异点在「附录」中说明。

### 3.4 OAuth2 流程选型

| 流程 | 用途 | 是否采用 |
| --- | --- | --- |
| **Authorization Code**（服务端） | 浏览器登录 | ✓ 主流程 |
| **Authorization Code + PKCE** | 浏览器登录（增强） | ✓ 推荐用于公开客户端 |
| Client Credentials | 服务间调用 | ✗ 不用于用户登录 |
| Password Grant | 直接传用户名密码 | ✗ 已废弃，不符合 OAuth2 安全最佳实践 |
| Implicit | SPA 直接拿 token | ✗ 已废弃 |
| Device Code | 设备授权 | ✗ 不适用 |

> 本计划采用 **Authorization Code + PKCE**，符合 OAuth 2.1 安全建议。

### 3.5 IdP 支持矩阵（一期）

| IdP | 后端类 | 配置项 | 说明 |
| --- | --- | --- | --- |
| Keycloak | `social_core.backends.keycloak.KeycloakOAuth2` | `KEYCLOAK_URL`、`KEYCLOAK_REALM`、`KEYCLOAK_CLIENT_ID`、`KEYCLOAK_CLIENT_SECRET` | 企业自建 IdP，首选 |
| Google | `social_core.backends.google.GoogleOAuth2` | `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY`、`SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET` | 公有云 |
| GitHub | `social_core.backends.github.GithubOAuth2` | `SOCIAL_AUTH_GITHUB_KEY`、`SOCIAL_AUTH_GITHUB_SECRET` | 开发者团队 |
| Azure AD | `social_core.backends.azuread.AzureADOAuth2` | `SOCIAL_AUTH_AZUREAD_OAUTH2_KEY`、`SOCIAL_AUTH_AZUREAD_OAUTH2_SECRET`、`tenant` | 微软生态 |
| 通用 OAuth2 | `social_core.backends.oauth.BaseOAuth2` 子类 | `authorization_url`、`access_token_url`、`userinfo_url` | 兜底，支持任意 OAuth2 IdP |

---

## 4. 总体设计

### 4.1 设计原则

1. **认证外置，授权内置**：IdP 只负责身份核验；角色、权限、组织成员关系全在本地
2. **JIT 优先**：首次 OAuth2 登录自动创建本地账号，降低管理员录入负担
3. **本地账号唯一**：所有用户在 `htx_user` 表中有一行；OAuth2 身份只是登录凭证
4. **多 IdP 并存**：可同时配置多个提供商，用户在登录页选择
5. **平滑过渡**：保留本地密码登录作为 fallback，由特性开关控制是否禁用
6. **服务账号不受影响**：DRF Token / JWT 仍用于 API 调用，不依赖 OAuth2
7. **特性开关**：`feat_oauth2_auth` 控制 OAuth2 是否启用，灰度上线

### 4.2 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│                       前端（React）                          │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 登录页            │  │ 账号设置页        │                │
│  │ - OAuth2 按钮     │  │ - 已关联身份      │                │
│  │ - 本地登录(可选)  │  │ - 绑定/解绑       │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端（Django + DRF）                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ oauth2_auth app（新增）                              │   │
│  │ - OAuth2Provider 配置模型                            │   │
│  │ - social-django pipeline 扩展                        │   │
│  │ - /auth/oauth/<provider>/login/  发起授权            │   │
│  │ - /auth/oauth/<provider>/complete/  回调             │   │
│  │ - /auth/oauth/<provider>/link/  绑定                 │   │
│  │ - /api/account/oauth-identities/  管理已绑定身份      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ users app（现有） │  │ organizations    │                │
│  │ - User CRUD      │  │ - 成员管理        │                │
│  │ - 本地账号管理    │  │ - 角色分配        │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ jwt_auth（现有）  │  │ core/permissions │                │
│  │ - 本地 JWT/Token │  │ - 本地权限校验    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────┬───────────────────────────────────┘
                          │ OAuth2 Authorization Code + PKCE
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  外部 IdP（Keycloak/Google/...）             │
│  - 用户身份存储                                           │
│  - 密码核验、MFA                                          │
│  - 颁发 access_token / id_token                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 认证与授权的职责分离

| 维度 | 认证（Authentication） | 授权（Authorization） |
| --- | --- | --- |
| 责任方 | 外部 IdP | Label Studio 本地 |
| 数据 | 用户凭证、MFA、密码策略 | 组织角色、项目角色、权限谓词 |
| 存储 | IdP 目录（LDAP/AD/数据库） | `htx_user`、`organization_member`、`project_member` |
| 时机 | 登录时 | 每次请求 |
| 产出 | 证明「你是某用户」 | 决定「你能做什么」 |
| 变更 | IdP 管理员 | LS 组织管理员 |

---

## 5. 数据模型设计

### 5.1 新增 `oauth2_auth` app

在 `label_studio/oauth2_auth/` 新建 app，并加入 `INSTALLED_APPS`（在 `users` 之后）。

### 5.2 复用 social-django 的 `UserSocialAuth`

social-django 自带 `social_django.UserSocialAuth` 模型，存储「本地 User ↔ OAuth2 身份」映射：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BigAutoField PK | 主键 |
| user_id | FK → htx_user.id | 本地用户 |
| provider | varchar(32) | 提供商名称（如 `google`、`keycloak`） |
| uid | varchar(255) | 该提供商内的唯一 ID（即 OAuth2 `sub`） |
| extra_data | JSONField | access_token、refresh_token、过期时间等 |
| created | datetime | 关联时间 |
| modified | datetime | 最近更新 |

**索引**：`(provider, uid)` 唯一；`(user_id, provider)` 唯一（一个用户在一个提供商只能绑一个身份）。

> 该模型由 social-django 的迁移自动建表，无需自己写迁移。表名 `social_auth_usersocialauth`。

### 5.3 新增 `OAuth2Provider`（IdP 配置模型）

为支持在 UI 上动态配置多个 IdP，新增配置模型：

```python
# label_studio/oauth2_auth/models.py
from django.db import models


class OAuth2Provider(models.Model):
    """OAuth2 身份提供商配置（组织级，便于多租户隔离）"""

    class Kind(models.TextChoices):
        KEYCLOAK = 'keycloak', 'Keycloak'
        GOOGLE = 'google', 'Google'
        GITHUB = 'github', 'GitHub'
        AZURE_AD = 'azuread', 'Azure AD'
        GENERIC = 'generic', 'Generic OAuth2'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='oauth_providers'
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    name = models.CharField(max_length=100, help_text='显示名称，如「公司 SSO」')
    enabled = models.BooleanField(default=True)

    # OAuth2 端点（generic 类型必填；其他类型由后端类提供默认值）
    authorization_url = models.URLField(blank=True, default='')
    access_token_url = models.URLField(blank=True, default='')
    userinfo_url = models.URLField(blank=True, default='')
    issuer = models.URLField(blank=True, default='', help_text='OIDC issuer，用于 ID Token 校验')

    # 凭证
    client_id = models.CharField(max_length=255)
    client_secret = models.EncryptedField(
        max_length=255, help_text='加密存储的 client_secret'
    )
    scopes = models.CharField(max_length=255, default='openid email profile')

    # 行为配置
    use_pkce = models.BooleanField(default=True, help_text='是否启用 PKCE')
    jit_create_user = models.BooleanField(
        default=True, help_text='首次登录是否自动创建本地账号'
    )
    default_org_role = models.CharField(
        max_length=20, default='MEMBER',
        help_text='JIT 创建用户的默认组织角色',
    )
    link_by_email = models.BooleanField(
        default=True,
        help_text='OAuth2 返回的 email 与本地 User 匹配时是否自动关联',
    )

    # 显示配置
    icon = models.CharField(max_length=50, blank=True, default='', help_text='图标标识')
    order = models.PositiveIntegerField(default=0, help_text='登录页按钮排序')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'enabled']),
            models.Index(fields=['organization', 'kind']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'], name='unique_provider_name_per_org'
            ),
        ]
```

> **加密说明**：`client_secret` 使用 `EncryptedField`（Django 4.2+，基于 Fernet）。若 Django 版本不支持，回退为 `SECRET_KEY` 加密的 `JSONField` 或使用 `django-fernet-fields`。

### 5.4 扩展 `User` 模型

在 [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) 的 `User` 增加字段：

```python
class User(UserMixin, AbstractBaseUser, PermissionsMixin, UserLastActivityMixin):
    ...
    # OAuth2 相关字段
    auth_source = models.CharField(
        max_length=20, default='local',
        help_text='账号来源：local 本地密码 / oauth2 OAuth2 自动创建',
    )
    last_oauth_login_at = models.DateTimeField(null=True, blank=True, help_text='最近 OAuth2 登录时间')
    last_oauth_provider = models.CharField(max_length=32, blank=True, default='', help_text='最近使用的 OAuth2 提供商')
    password = models.CharField(_('password'), max_length=128, blank=True, help_text='OAuth2 用户的密码为空')
```

**关键改动**：

- `password` 改为 `blank=True`，允许 OAuth2 用户无密码
- `set_unusable_password()` 用于 OAuth2 用户（Django 内置方法）
- `has_usable_password()` 用于判断是否可走本地密码登录

### 5.5 ER 关系

```text
┌─────────────┐         ┌──────────────────────────┐
│  htx_user   │ 1───N   │ social_auth_usersocialauth│
│ - id        │◄────────┤ - user_id                │
│ - email     │         │ - provider               │
│ - password  │         │ - uid (OAuth2 sub)       │
│   (可空)    │         │ - extra_data             │
│ - auth_source│        └──────────────────────────┘
│   (NEW)     │
└──────┬──────┘
       │ N
       │
       ▼ 1
┌──────────────────────┐
│ organization         │
│ - id                 │
└──────────┬───────────┘
           │ 1
           │ N
┌──────────┴───────────┐
│ oauth2_provider      │  IdP 配置（组织级）
│ - organization_id    │
│ - kind, name         │
│ - client_id          │
│ - client_secret (加密)│
│ - jit_create_user    │
└──────────────────────┘
```

### 5.6 与现有模型的关系

| 现有模型 | 关系 | 说明 |
| --- | --- | --- |
| `htx_user` | 1:N `UserSocialAuth` | 一个本地用户可绑定多个 OAuth2 身份 |
| `organization` | 1:N `OAuth2Provider` | 一个组织可配置多个 IdP |
| `organization_member` | 不变 | OAuth2 用户 JIT 创建后自动加入组织，角色由 `default_org_role` 决定 |
| `authtoken_token` | 不变 | OAuth2 用户登录后仍可生成 DRF Token 用于 API |
| `JWTSettings` | 不变 | 本地 JWT 机制保留 |

---

## 6. 后端实现计划

### 6.1 新增文件清单

| 文件 | 说明 |
| --- | --- |
| `label_studio/oauth2_auth/__init__.py` | app 初始化 |
| `label_studio/oauth2_auth/apps.py` | AppConfig，注册 social-django pipeline |
| `label_studio/oauth2_auth/models.py` | `OAuth2Provider` 模型 |
| `label_studio/oauth2_auth/migrations/0001_initial.py` | 初始迁移 |
| `label_studio/oauth2_auth/backends.py` | 动态 OAuth2 后端工厂（从 DB 读取配置） |
| `label_studio/oauth2_auth/pipeline.py` | social-django pipeline 扩展（关联、JIT、角色） |
| `label_studio/oauth2_auth/views.py` | 登录发起、回调、绑定/解绑视图 |
| `label_studio/oauth2_auth/urls.py` | 路由 |
| `label_studio/oauth2_auth/serializers.py` | `OAuth2ProviderSerializer` |
| `label_studio/oauth2_auth/api.py` | IdP 配置 CRUD API |
| `label_studio/oauth2_auth/middleware.py` | OAuth2 登录状态检测中间件 |
| `label_studio/oauth2_auth/admin.py` | Django Admin 配置 |
| `label_studio/oauth2_auth/utils.py` | PKCE、state、token 校验工具 |

### 6.2 修改的现有文件

| 文件 | 改动 |
| --- | --- |
| [core/settings/base.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py) | `INSTALLED_APPS` 加 `social_django`、`oauth2_auth`；`AUTHENTICATION_BACKENDS` 加动态后端；加 social-django 配置 |
| [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) | `User` 加 `auth_source`、`last_oauth_login_at`、`last_oauth_provider`；`password` 改 `blank=True` |
| [users/migrations/0012_oauth_fields.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/migrations) | 加字段迁移 |
| [users/views.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/views.py) | `user_login` 增加 OAuth2 按钮上下文；`logout` 增加 IdP SLO 可选 |
| [users/functions/common.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/functions/common.py) | `save_user` 支持 `auth_source='oauth2'` 路径 |
| [core/middleware.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/middleware.py) | 新增 `OAuth2LoginRequiredMiddleware`（可选强制 OAuth2） |
| [core/feature_flags.json](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/feature_flags.json) | 加 `feat_oauth2_auth`、`feat_disable_local_login` 开关 |
| [users/templates/users/user_login.html](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/templates/users/user_login.html) | 渲染 OAuth2 按钮 |
| [users/templates/users/user_signup.html](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/templates/users/user_signup.html) | 渲染 OAuth2 按钮（或禁用注册） |

### 6.3 依赖引入

```toml
# pyproject.toml [tool.poetry.dependencies]
social-auth-app-django = ">=5.4.0"
# 可选：加密字段
django-fernet-fields = {version = ">=0.7", markers = "django_version < '4.2'"}
```

### 6.4 social-django 配置

```python
# label_studio/core/settings/base.py（追加）

# social-django 配置
SOCIAL_AUTH_TRAILING_SLASH = False
SOCIAL_AUTH_URL_NAMESPACE = 'social'
SOCIAL_AUTH_USER_MODEL = 'users.User'

# Pipeline：在默认 pipeline 基础上插入自定义步骤
SOCIAL_AUTH_PIPELINE = (
    # 1. 获取 uid
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.social_user',
    # 2. 自定义：按 email 关联现有账号
    'oauth2_auth.pipeline.link_by_email',
    # 3. 自定义：JIT 创建用户（含组织、角色）
    'oauth2_auth.pipeline.create_user_with_org',
    # 4. 自定义：更新最近 OAuth2 登录信息
    'oauth2_auth.pipeline.update_oauth_login_info',
    # 5. 关联 social_auth 记录
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
)

# 状态保持
SOCIAL_AUTH_FIELDS_STORED_IN_SESSION = ['next', 'provider_pk']
SOCIAL_AUTH_REDIRECT_IS_HTTPS = get_bool_env('SOCIAL_AUTH_REDIRECT_IS_HTTPS', True)
SOCIAL_AUTH_SANITIZE_REDIRECTS = True  # 防开放重定向

# 错误处理
SOCIAL_AUTH_LOGIN_ERROR_URL = '/user/login/?oauth_error=1'
SOCIAL_AUTH_NEW_ASSOCIATION_REDIRECT_URL = '/user/account/'

# 动态后端：从 DB 读取配置（见 6.5）
AUTHENTICATION_BACKENDS = [
    'oauth2_auth.backends.DynamicOAuth2Backend',  # 动态 OAuth2 后端
    'rules.permissions.ObjectPermissionBackend',
    'django.contrib.auth.backends.ModelBackend',
    'social_core.backends.google.GoogleOAuth2',
    'social_core.backends.github.GithubOAuth2',
    'social_core.backends.azuread.AzureADOAuth2',
    # 其他内置后端...
]
```

### 6.5 动态后端工厂

social-django 默认从 settings 读取每个 IdP 的 `client_id`/`secret`。为支持在 UI 上动态配置，需实现动态后端：

```python
# label_studio/oauth2_auth/backends.py
from social_core.backends.oauth import BaseOAuth2
from oauth2_auth.models import OAuth2Provider


class DynamicOAuth2Backend(BaseOAuth2):
    """根据 URL 中的 provider_pk 动态加载 OAuth2Provider 配置"""

    name = 'dynamic'
    ID_KEY = 'sub'

    def auth_url(self):
        # 从 session 取 provider_pk
        provider_pk = self.strategy.session_get('provider_pk')
        self._load_config(provider_pk)
        return super().auth_url()

    def _load_config(self, provider_pk):
        provider = OAuth2Provider.objects.get(pk=provider_pk)
        self.AUTHORIZATION_URL = provider.authorization_url
        self.ACCESS_TOKEN_URL = provider.access_token_url
        self.USER_DATA_URL = provider.userinfo_url
        self.SCOPE = provider.scopes.split()
        self.client_id = provider.client_id
        self.client_secret = provider.client_secret
        self.REDIRECT_URI = self.strategy.build_absolute_uri(
            f'/auth/oauth/{provider_pk}/complete/'
        )
        self.provider = provider

    def get_user_details(self, response):
        """从 userinfo 响应提取用户信息"""
        return {
            'email': response.get('email') or response.get('preferred_username'),
            'first_name': response.get('given_name', ''),
            'last_name': response.get('family_name', ''),
            'sub': response.get('sub'),
        }

    def user_data(self, access_token, *args, **kwargs):
        """调用 userinfo 端点获取用户信息"""
        import requests
        headers = {'Authorization': f'Bearer {access_token}'}
        resp = requests.get(self.USER_DATA_URL, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
```

### 6.6 自定义 Pipeline

```python
# label_studio/oauth2_auth/pipeline.py
import logging
from organizations.models import Organization, OrganizationMember
from users.models import User

logger = logging.getLogger(__name__)


def link_by_email(backend, details, response, user=None, *args, **kwargs):
    """按 email 关联现有本地账号（如果配置允许）"""
    if user is not None:
        return None

    provider_pk = backend.strategy.session_get('provider_pk')
    from oauth2_auth.models import OAuth2Provider
    provider = OAuth2Provider.objects.get(pk=provider_pk)

    if not provider.link_by_email:
        return None

    email = details.get('email')
    if not email:
        return None

    try:
        existing = User.objects.get(email=email)
        logger.info(f'OAuth2: linked existing user {existing.id} by email')
        return {'user': existing, 'is_new': False}
    except User.DoesNotExist:
        return None


def create_user_with_org(strategy, details, backend, user=None, *args, **kwargs):
    """JIT 创建本地用户并加入组织"""
    if user is not None:
        return None

    provider_pk = backend.strategy.session_get('provider_pk')
    from oauth2_auth.models import OAuth2Provider
    provider = OAuth2Provider.objects.get(pk=provider_pk)

    if not provider.jit_create_user:
        raise ValueError('未关联本地账号，且 JIT 创建已禁用')

    email = details.get('email')
    if not email:
        raise ValueError('OAuth2 返回的用户信息缺少 email')

    # 创建用户（无密码）
    user = User(
        email=email,
        username=email.split('@')[0],
        first_name=details.get('first_name', ''),
        last_name=details.get('last_name', ''),
        auth_source='oauth2',
    )
    user.set_unusable_password()
    user.save()

    # 加入组织并分配默认角色
    org = provider.organization
    org.add_user(user)
    user.active_organization = org
    user.save(update_fields=['active_organization'])

    # 设置组织角色（见 AUTHORIZATION.md 的 OrganizationMember.role）
    member = OrganizationMember.objects.get(user=user, organization=org)
    member.role = provider.default_org_role
    member.save(update_fields=['role'])

    logger.info(f'OAuth2 JIT: created user {user.id} with role {provider.default_org_role}')
    return {'user': user, 'is_new': True}


def update_oauth_login_info(strategy, details, backend, user=None, *args, **kwargs):
    """更新最近 OAuth2 登录信息"""
    if user is None:
        return None
    from django.utils import timezone
    user.last_oauth_login_at = timezone.now()
    user.last_oauth_provider = backend.name
    user.save(update_fields=['last_oauth_login_at', 'last_oauth_provider'])
    return None
```

### 6.7 视图与路由

```python
# label_studio/oauth2_auth/urls.py
from django.urls import path, include
from . import views

urlpatterns = [
    # 发起 OAuth2 登录
    path('auth/oauth/<int:provider_pk>/login/', views.oauth_login, name='oauth-login'),
    # 回调（social-django 处理）
    path('auth/oauth/<int:provider_pk>/complete/',
         views.oauth_complete, name='oauth-complete'),
    # 绑定已登录用户
    path('auth/oauth/<int:provider_pk>/link/', views.oauth_link, name='oauth-link'),
    # 解绑
    path('api/account/oauth-identities/<int:social_id>/',
         views.unlink_identity, name='oauth-unlink'),
    # IdP 配置 API
    path('api/oauth/providers/', views.OAuth2ProviderAPI.as_view()),
    path('api/oauth/providers/<int:pk>/', views.OAuth2ProviderAPI.as_view()),
]
```

```python
# label_studio/oauth2_auth/views.py
from django.shortcuts import redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from social_core.actions import do_auth, do_complete
from social_django.utils import load_strategy, load_backend

from oauth2_auth.models import OAuth2Provider
from oauth2_auth.serializers import OAuth2ProviderSerializer


def oauth_login(request, provider_pk):
    """发起 OAuth2 授权"""
    provider = get_object_or_404(OAuth2Provider, pk=provider_pk, enabled=True)
    request.session['provider_pk'] = provider_pk
    request.session['oauth_next'] = request.GET.get('next', '/')
    strategy = load_strategy(request)
    backend = load_backend(strategy=strategy, name='dynamic', redirect_uri=None)
    backend._load_config(provider_pk)
    return do_auth(backend, redirect_name='next')


def oauth_complete(request, provider_pk):
    """OAuth2 回调处理"""
    strategy = load_strategy(request)
    backend = load_backend(strategy=strategy, name='dynamic', redirect_uri=None)
    backend._load_config(provider_pk)
    return do_complete(
        backend, login=lambda req, u: _ls_login(req, u),
        redirect_name='next', request=request
    )


def _ls_login(request, user):
    """复用 LS 的登录逻辑（写 session['last_login']）"""
    from users.functions import login
    login(request, user, backend='oauth2_auth.backends.DynamicOAuth2Backend')
    # 绑定 active_organization
    from organizations.models import Organization
    org_pk = Organization.find_by_user(user).pk
    user.active_organization_id = org_pk
    user.save(update_fields=['active_organization'])


@login_required
def oauth_link(request, provider_pk):
    """已登录用户绑定新的 OAuth2 身份"""
    request.session['provider_pk'] = provider_pk
    request.session['oauth_link_mode'] = True
    return oauth_login(request, provider_pk)


@login_required
@require_http_methods(['DELETE'])
def unlink_identity(request, social_id):
    """解绑 OAuth2 身份"""
    from social_django.models import UserSocialAuth
    identity = get_object_or_404(UserSocialAuth, pk=social_id, user=request.user)
    # 防止用户解绑所有登录方式（若本地密码不可用且只剩一个 OAuth2 身份）
    if not request.user.has_usable_password():
        count = UserSocialAuth.objects.filter(user=request.user).count()
        if count <= 1:
            return JsonResponse(
                {'detail': '不能解绑最后一个登录方式，请先设置本地密码或绑定其他身份'},
                status=400
            )
    identity.delete()
    return JsonResponse({'detail': '解绑成功'})


@method_decorator(login_required, name='dispatch')
class OAuth2ProviderAPI(viewsets.ModelViewSet):
    """IdP 配置 CRUD（仅组织 ADMIN/OWNER）"""
    serializer_class = OAuth2ProviderSerializer
    queryset = OAuth2Provider.objects.all()

    def get_queryset(self):
        return self.queryset.filter(organization=self.request.user.active_organization)

    def check_permissions(self, request):
        super().check_permissions(request)
        # 仅 ADMIN/OWNER 可管理（见 AUTHORIZATION.md 的 RBAC）
        if not request.user.is_organization_admin(request.user.active_organization_id):
            self.permission_denied(request)
```

### 6.8 API 设计

#### 6.8.1 IdP 配置 `/api/oauth/providers/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/oauth/providers/` | `organizations_view` | 列出本组织 IdP 配置 |
| POST | `/api/oauth/providers/` | `organizations_change` | 新增 IdP 配置 |
| GET | `/api/oauth/providers/{id}/` | `organizations_view` | 详情 |
| PATCH | `/api/oauth/providers/{id}/` | `organizations_change` | 修改 |
| DELETE | `/api/oauth/providers/{id}/` | `organizations_change` | 删除 |
| POST | `/api/oauth/providers/{id}/test/` | `organizations_change` | 测试连接（发起一次模拟授权） |

#### 6.8.2 账号身份管理 `/api/account/oauth-identities/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/account/oauth-identities/` | `IsAuthenticated` | 列出当前用户已绑定的 OAuth2 身份 |
| DELETE | `/api/account/oauth-identities/{id}/` | `IsAuthenticated` | 解绑（有保护：不能解绑最后一个） |
| GET | `/api/account/oauth-identities/available/` | `IsAuthenticated` | 列出可绑定的 IdP |

#### 6.8.3 登录页元数据 `/api/auth/methods/`（公开）

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/auth/methods/` | `AllowAny` | 列出启用的 OAuth2 提供商 + 本地登录是否启用（供登录页渲染） |

响应示例：

```json
{
  "oauth_providers": [
    {"id": 1, "name": "公司 SSO", "kind": "keycloak", "icon": "keycloak", "order": 1},
    {"id": 2, "name": "GitHub", "kind": "github", "icon": "github", "order": 2}
  ],
  "local_login_enabled": true,
  "signup_enabled": false
}
```

---

## 7. 账号管理方案

> **核心要求**：身份验证用 OAuth2，但用户的权限、用户的 CRUD 应该在项目中管理。

### 7.1 账号 CRUD 的本地化

OAuth2 只负责「证明身份」，账号的全生命周期管理仍在 Label Studio 内。具体职责划分：

| 操作 | 责任方 | 说明 |
| --- | --- | --- |
| 用户在 IdP 注册 | IdP 管理员 | IdP 维护用户凭证、密码、MFA |
| 用户首次登录 LS | LS（JIT） | LS 自动创建本地 `htx_user` 记录 |
| 管理员创建账号 | LS 管理员 | 通过 `/api/users/` 创建（可选择性在 IdP 预先存在） |
| 修改姓名/电话/头像 | LS | 通过 `/api/users/{id}/` 修改本地字段 |
| 重置密码 | IdP | LS 不再存储密码；用户去 IdP 重置 |
| 启用/停用账号 | LS | `is_active_account=False`（见 AUTHORIZATION.md） |
| 删除账号 | LS | 软删除 `OrganizationMember`，可选硬删除 `htx_user` |
| 分配组织角色 | LS | `OrganizationMember.role` |
| 分配项目角色 | LS | `ProjectMember.role` |
| 解绑 OAuth2 身份 | LS（用户自助/管理员） | `/api/account/oauth-identities/{id}/` |

### 7.2 账号 CRUD API（沿用现有，扩展字段）

复用 [../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md) 中定义的 `/api/users/` 接口，序列化器增加 OAuth2 相关字段：

```python
# label_studio/users/serializers.py（扩展）
class UserDetailSerializer(BaseUserSerializer):
    organization_role = serializers.SerializerMethodField()
    oauth_identities = serializers.SerializerMethodField()
    auth_source = serializers.CharField()
    has_usable_password = serializers.SerializerMethodField()

    def get_oauth_identities(self, obj):
        from social_django.models import UserSocialAuth
        return UserSocialAuth.objects.filter(user=obj).values('id', 'provider', 'uid', 'modified')

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()
```

### 7.3 管理员创建账号（非 JIT 路径）

管理员可通过两种方式创建账号：

**方式一：纯本地账号（保留本地密码登录）**

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

**方式二：预创建 OAuth2 账号（无密码，等待用户首次 OAuth2 登录激活）**

```json
POST /api/users/
{
  "email": "annotator@example.com",
  "first_name": "张",
  "last_name": "三",
  "auth_source": "oauth2",
  "organization_role": "MEMBER"
}
```

后端逻辑：

```python
# users/api.py UserAPI.create 扩展
def create(self, request, *args, **kwargs):
    auth_source = request.data.get('auth_source', 'local')
    if auth_source == 'oauth2':
        # 不设密码，等待 OAuth2 登录关联
        user = User(
            email=request.data['email'],
            username=request.data['email'].split('@')[0],
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', ''),
            auth_source='oauth2',
        )
        user.set_unusable_password()
        user.save()
        # 加入组织...
    else:
        # 走原有本地创建逻辑
        ...
```

### 7.4 账号停用与登录阻断

停用账号（`is_active_account=False`，见 AUTHORIZATION.md）后：

1. **本地 Session**：下次请求时 `UpdateLastActivityMiddleware` 校验 `is_active_account`，若为 False 则 `logout`
2. **DRF Token / JWT**：在 `TokenAuthenticationPhaseout.authenticate` 与 `JWTAuthenticationMiddleware` 中增加 `is_active_account` 校验
3. **OAuth2 登录**：在 pipeline 的 `update_oauth_login_info` 之前校验 `is_active_account`，若为 False 抛出 `AuthForbidden`

```python
# oauth2_auth/pipeline.py
def update_oauth_login_info(strategy, details, backend, user=None, *args, **kwargs):
    if user is None:
        return None
    if not user.is_active_account:
        raise social_core.exceptions.AuthForbidden(backend)
    # ... 原有逻辑
```

### 7.5 账号关联与解绑

#### 7.5.1 用户自助绑定

已登录用户可在「账号设置」页绑定新的 OAuth2 身份：

1. 用户点击「绑定 GitHub」按钮 → 跳转 `/auth/oauth/{provider_pk}/link/`
2. 设置 `session['oauth_link_mode'] = True`
3. 跳转到 IdP 授权
4. 回调时 pipeline 检测到 `oauth_link_mode`，跳过 `create_user_with_org`，直接调用 `associate_user` 关联到当前 `request.user`
5. 重定向回账号设置页

#### 7.5.2 解绑保护

解绑时检查：

- 用户是否还有其他可用登录方式（本地密码可用 / 至少一个 OAuth2 身份）
- 若都不满足，拒绝解绑，提示「请先设置本地密码或绑定其他身份」

### 7.6 与 AUTHORIZATION.md 的协同

本计划与 [../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md) 完全协同：

| AUTHORIZATION.md 的能力 | 本计划的影响 |
| --- | --- |
| `OrganizationMember.role` | OAuth2 JIT 创建用户时按 `default_org_role` 赋值 |
| `ProjectMember.role` | 不受影响，仍由管理员在项目成员页分配 |
| `is_active_account` | OAuth2 登录时校验，停用账号无法登录 |
| `feat_account_rbac` 开关 | 与 `feat_oauth2_auth` 独立，可分别启用 |
| `/api/users/` CRUD | 不变，增加 `auth_source`、`oauth_identities` 字段 |
| `is_organization_admin` 改造 | 不变，仍按 `OrganizationMember.role` 判断 |

### 7.7 服务账号与 API Token

OAuth2 用于「人类用户登录」，但 API 调用仍需 Token：

| 场景 | 方式 | 说明 |
| --- | --- | --- |
| 人类用户通过浏览器 | OAuth2 登录 → Session | 主要场景 |
| 人类用户通过 SDK/API | 登录后在「账号设置」生成 DRF Token / JWT | 沿用现有机制 |
| 服务账号（CI/CD、外部系统） | 管理员创建本地账号 → 生成 Token | 不走 OAuth2 |
| ML Backend 回调 | DRF Token | 不走 OAuth2 |

> 服务账号建议设 `auth_source='local'` 且 `is_active_account=True`，不绑定任何 OAuth2 身份。

---

## 8. 前端实现计划

### 8.1 登录页改造

**位置**：[users/templates/users/user_login.html](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/templates/users/user_login.html) 与 [users/templates/users/new-ui/user_login.html](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/templates/users/new-ui/user_login.html)

**改动**：

1. 在表单上方渲染 OAuth2 按钮（从 `/api/auth/methods/` 获取）
2. 按钮点击跳转 `/auth/oauth/{provider_pk}/login/?next=...`
3. 若 `local_login_enabled=false`，隐藏邮箱+密码表单
4. OAuth2 错误提示（`?oauth_error=1`）

**React 版本**（主应用登录页）：

```tsx
// web/apps/labelstudio/src/pages/Login/index.tsx
function LoginPage() {
  const { data: methods } = useQuery({
    queryKey: ['auth-methods'],
    queryFn: () => api.getAuthMethods(),
  })

  return (
    <div>
      {methods?.oauth_providers.map((p) => (
        <OAuthButton
          key={p.id}
          provider={p}
          onClick={() => window.location.href = `/auth/oauth/${p.id}/login/?next=${encodeURIComponent(nextPage)}`}
        />
      ))}
      {methods?.local_login_enabled && (
        <LocalLoginForm />
      )}
    </div>
  )
}
```

### 8.2 账号设置页增强

**位置**：`web/apps/labelstudio/src/pages/Account/`

新增「已绑定的 OAuth2 身份」区块：

1. 列表展示已绑定的 OAuth2 身份（提供商、UID、绑定时间）
2. 「绑定新身份」按钮 → 弹出可选 IdP 列表
3. 行操作：解绑（带保护提示）
4. 若 `has_usable_password=false`，提示「此账号无本地密码，无法使用邮箱密码登录」
5. 「设置本地密码」按钮（可选，便于 fallback）

### 8.3 IdP 配置管理页

**位置**：`web/apps/labelstudio/src/pages/Organization/Settings/OAuthProviders/`

**功能**：

1. IdP 列表（名称、类型、状态、最近登录数）
2. 新增/编辑 IdP 配置表单（类型、端点、client_id/secret、scopes、JIT 开关、默认角色）
3. 「测试连接」按钮
4. 启用/停用切换
5. 权限：仅组织 ADMIN/OWNER 可见

**组件结构**：

```text
OAuthProviders/
├── index.tsx
├── provider-list.tsx
├── provider-form-modal.tsx
├── provider-test-button.tsx
└── oauth-providers.module.css
```

### 8.4 API 客户端

```typescript
// web/libs/app-common/src/api/oauth2.ts
export const oauth2Api = {
  getAuthMethods: () => http.get('/api/auth/methods/'),
  listProviders: () => http.get('/api/oauth/providers/'),
  createProvider: (data: CreateProviderPayload) => http.post('/api/oauth/providers/', data),
  updateProvider: (id: number, data: Partial<Provider>) => http.patch(`/api/oauth/providers/${id}/`, data),
  deleteProvider: (id: number) => http.delete(`/api/oauth/providers/${id}/`),
  testProvider: (id: number) => http.post(`/api/oauth/providers/${id}/test/`),
  listMyIdentities: () => http.get('/api/account/oauth-identities/'),
  listAvailableProviders: () => http.get('/api/account/oauth-identities/available/'),
  unlinkIdentity: (id: number) => http.delete(`/api/account/oauth-identities/${id}/`),
}
```

### 8.5 状态管理

```typescript
// web/apps/labelstudio/src/store/auth-methods.ts
import { atomWithQuery } from 'jotai-tanstack-query'

export const authMethodsAtom = atomWithQuery(() => ({
  queryKey: ['auth-methods'],
  queryFn: () => oauth2Api.getAuthMethods(),
}))

export const myIdentitiesAtom = atomWithQuery(() => ({
  queryKey: ['my-oauth-identities'],
  queryFn: () => oauth2Api.listMyIdentities(),
}))
```

---

## 9. 安全设计

### 9.1 OAuth2 安全要点

| 要点 | 实现 |
| --- | --- |
| **PKCE** | 默认启用 `use_pkce=True`，每个请求生成随机 `code_verifier` 与 `code_challenge` |
| **state 参数** | social-django 自动生成并校验 `state`，防止 CSRF |
| **nonce**（OIDC） | 校验 ID Token 中的 `nonce` |
| **redirect_uri 校验** | 严格匹配预注册的回调地址，`SOCIAL_AUTH_SANITIZE_REDIRECTS=True` 防开放重定向 |
| **client_secret 加密存储** | 使用 `EncryptedField` 或 `django-fernet-fields` |
| **TLS 强制** | `SOCIAL_AUTH_REDIRECT_IS_HTTPS=True`，IdP 端点必须 HTTPS |
| **access_token 不透传前端** | access_token 仅在后端用于换取 userinfo，不返回给浏览器 |
| **token 过期处理** | 不存储 refresh_token（一期），每次登录重新走授权流程 |
| **scope 最小化** | 默认 `openid email profile`，不申请写权限 |
| **id_token 校验** | 校验签名（用 IdP 的 JWKS）、`iss`、`aud`、`exp` |

### 9.2 PKCE 实现

```python
# label_studio/oauth2_auth/utils.py
import secrets
import hashlib
import base64

def generate_pkce_pair():
    """生成 PKCE code_verifier 与 code_challenge"""
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip('=')
    return verifier, challenge
```

### 9.3 登录安全

| 威胁 | 对策 |
| --- | --- |
| 开放重定向 | `SOCIAL_AUTH_SANITIZE_REDIRECTS=True`，`next` 参数校验同源 |
| 账号枚举 | 登录失败统一返回「认证失败」，不区分用户是否存在 |
| 会话固定 | OAuth2 登录成功后 `request.session.cycle_key()` |
| Token 泄露 | access_token 仅在后端内存中，不写库、不返回前端 |
| 重新定向攻击 | state 绑定 session，校验 |
| IdP 伪造 | 校验 ID Token 签名（JWKS） |
| 暴力破解 | OAuth2 由 IdP 负责；本地登录保留时加 rate limit |
| 中间人攻击 | 全链路 HTTPS；HSTS 头 |

### 9.4 client_secret 加密

```python
# label_studio/oauth2_auth/models.py
from django.db import models

try:
    from django.db.models import EncryptedField  # Django 4.2+
    SecretField = EncryptedField
except ImportError:
    from fernet_fields import EncryptedCharField as SecretField

class OAuth2Provider(models.Model):
    ...
    client_secret = SecretField(max_length=255)
```

### 9.5 审计日志

记录以下事件（写入 `audit_log` 表或日志文件）：

| 事件 | 字段 |
| --- | --- |
| OAuth2 登录成功 | user_id, provider, ip, user_agent, timestamp |
| OAuth2 登录失败 | provider, ip, reason, timestamp |
| JIT 创建用户 | user_id, provider, default_role |
| 账号绑定 | user_id, provider, uid |
| 账号解绑 | user_id, provider, uid |
| IdP 配置变更 | admin_id, provider_id, action, diff |

---

## 10. 迁移与兼容策略

### 10.1 数据库迁移顺序

1. **Step 1**：安装 `social-auth-app-django`，运行其迁移建 `social_auth_usersocialauth` 等表
2. **Step 2**：创建 `oauth2_auth` app，运行 `OAuth2Provider` 迁移
3. **Step 3**：`users` 迁移：加 `auth_source`、`last_oauth_login_at`、`last_oauth_provider`；改 `password` 为 `blank=True`
4. **Step 4**：数据迁移 — 现有用户 `auth_source='local'`；现有 `password` 非空保持不变

> 说明：`password` 改 `blank=True` 不影响已存储的哈希值，仅允许新用户无密码。

### 10.2 灰度发布策略

通过两个特性开关控制：

| 开关 | 默认 | 作用 |
| --- | --- | --- |
| `feat_oauth2_auth` | False | 启用 OAuth2 登录能力（显示按钮、接受回调） |
| `feat_disable_local_login` | False | 禁用本地密码登录（隐藏表单、拒绝 POST） |

阶段：

1. **阶段 1**：合并代码，两开关均 False，行为不变
2. **阶段 2**：开启 `feat_oauth2_auth`，登录页出现 OAuth2 按钮，本地登录仍可用
3. **阶段 3**：在试点组织配置 IdP，验证 OAuth2 流程
4. **阶段 4**：全量开启 `feat_oauth2_auth`
5. **阶段 5**（可选）：对纯 OAuth2 组织开启 `feat_disable_local_login`，强制 SSO
6. **阶段 6**：稳定后移除开关判断分支

### 10.3 兼容性保证

| 场景 | 兼容措施 |
| --- | --- |
| 现有本地密码用户 | `auth_source='local'`，密码哈希保留，可继续本地登录 |
| 现有 DRF Token / JWT | 不受影响，仍用于 API 调用 |
| 现有 `UserManager.create_user` | 保留，OAuth2 用户走单独创建路径 |
| Enterprise 扩展 | 通过 `settings.USER_MIXIN`、`settings.OAUTH2_BACKEND_MIXIN` 留扩展点 |
| IdP 不可用 | 本地登录仍可用（若未禁用）；服务账号 Token 不受影响 |
| OAuth2 用户被停用 | pipeline 校验 `is_active_account`，拒绝登录 |

### 10.4 旧密码登录的退场

若决定最终完全停用本地密码登录：

1. 全量开启 `feat_disable_local_login`
2. 调用 `User.objects.filter(auth_source='local').update(password='')` 或 `set_unusable_password()`
3. 移除 `users/views.py` 的 `user_login` 表单分支
4. 移除 `ModelBackend`（保留 `ObjectPermissionBackend` 与 OAuth2 后端）
5. 在文档中声明「密码由 IdP 管理」

---

## 11. 测试计划

### 11.1 后端单元测试

| 测试文件 | 覆盖范围 |
| --- | --- |
| `oauth2_auth/tests/test_models.py` | `OAuth2Provider` 字段、加密、约束 |
| `oauth2_auth/tests/test_backends.py` | 动态后端配置加载、userinfo 解析 |
| `oauth2_auth/tests/test_pipeline.py` | `link_by_email`、`create_user_with_org`、`update_oauth_login_info` |
| `oauth2_auth/tests/test_views.py` | 登录发起、回调、绑定、解绑 |
| `oauth2_auth/tests/test_api.py` | IdP 配置 CRUD、权限校验 |
| `oauth2_auth/tests/test_security.py` | PKCE、state、redirect_uri 校验、开放重定向 |
| `users/tests/test_oauth_fields.py` | `auth_source`、`has_usable_password` |
| `users/tests/test_login.py` | OAuth2 登录后 Session 建立、`active_organization` 设置 |

### 11.2 集成测试场景

1. **JIT 创建用户**
   - 配置 Keycloak IdP → 用户首次 OAuth2 登录 → 自动创建本地 User（role=MEMBER）→ 加入组织 → 登录成功
2. **按 email 关联现有账号**
   - 本地已有 `user@example.com` → OAuth2 返回相同 email → 自动关联 → 登录到原账号
3. **多 IdP 登录**
   - 配置 Keycloak + GitHub → 用户分别用两者登录 → 关联到同一本地 User
4. **账号绑定与解绑**
   - 已登录用户绑定 GitHub → 解绑 GitHub → 解绑最后一个时被拒绝
5. **停用账号无法 OAuth2 登录**
   - 管理员停用账号 → 用户 OAuth2 登录被拒
6. **服务账号不受影响**
   - 服务账号 Token 调用 API → 成功（不依赖 OAuth2）
7. **特性开关**
   - `feat_oauth2_auth=False` → 登录页无 OAuth2 按钮，回调返回 404
   - `feat_disable_local_login=True` → 本地登录表单隐藏，POST 被拒
8. **SSO 流程**
   - 用户已在 IdP 登录 → 访问 LS → 自动跳转 IdP → 自动回跳 LS → 免输密码登录
9. **IdP 不可用**
   - IdP 宕机 → OAuth2 登录失败 → 本地登录仍可用（若未禁用）
10. **开放重定向防护**
    - `next=https://evil.com` → 被拒绝
11. **state/CSRF 防护**
    - 篡改 state → 回调被拒

### 11.3 前端测试

- 登录页 OAuth2 按钮渲染（多种 IdP）
- 账号设置页身份列表、绑定/解绑交互
- IdP 配置管理页表单校验

### 11.4 安全测试

- OWASP Top 10 自查（注入、XSS、CSRF、开放重定向）
- PKCE 流程验证（code_challenge 截获无法换 token）
- client_secret 加密存储验证（数据库泄露不可逆）
- token 不出现在浏览器端验证

### 11.5 性能测试

- OAuth2 回调延迟（含 IdP 网络往返）应 < 3s
- 登录页 `/api/auth/methods/` 响应 < 100ms
- 大型组织（1000 用户 × 5 IdP）下 IdP 配置查询性能

---

## 12. 里程碑与交付物

### 12.1 里程碑划分

| 里程碑 | 内容 | 交付物 |
| --- | --- | --- |
| M1：基础设施 | social-django 集成、`oauth2_auth` app、模型、迁移 | 依赖、模型、迁移、单元测试 |
| M2：后端流程 | 动态后端、pipeline、登录/回调/绑定/解绑视图 | 后端代码、API、集成测试 |
| M3：账号管理 | `User` 扩展字段、`/api/users/` 增强、JIT 与预创建 | API 代码、测试 |
| M4：前端登录与设置 | 登录页 OAuth2 按钮、账号设置页身份管理 | React 组件、E2E |
| M5：IdP 配置管理 | IdP 配置 CRUD 页面、测试连接 | React 组件、E2E |
| M6：安全与灰度 | PKCE、加密、审计、特性开关 | 安全测试报告、灰度文档 |
| M7：全量发布 | 默认启用、文档、培训 | 最终版本、用户手册 |

### 12.2 交付物清单

1. 后端代码（按 [6.1](#61-新增文件清单)、[6.2](#62-修改的现有文件) 文件清单）
2. 前端代码（按 [8.2](#82-账号设置页增强)、[8.3](#83-idp-配置管理页) 结构）
3. 数据库迁移文件
4. IdP 配置文档（Keycloak、Google、GitHub、Azure AD 接入指南）
5. 单元测试 + 集成测试 + E2E 测试
6. API 文档（Swagger 自动生成）
7. 用户操作手册（管理员配置 IdP、用户绑定身份）
8. 安全自查报告

---

## 13. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| IdP 宕机导致全员无法登录 | 业务停摆 | 保留本地登录 fallback；服务账号 Token 不依赖 OAuth2；监控 IdP 健康 |
| social-django 维护停滞 | 安全漏洞无人修 | 锁定版本并定期自查；关键 pipeline 自研可替换 |
| client_secret 泄露 | IdP 被冒用 | 加密存储；定期轮换；审计访问；IdP 侧限制 redirect_uri |
| OAuth2 用户与本地用户 email 冲突 | 账号合并争议 | `link_by_email` 可配置；冲突时优先人工关联；提供「拒绝 JIT，需管理员预创建」模式 |
| IdP 返回的 email 未验证 | 冒名顶替 | 校验 `email_verified` 字段；未验证时拒绝 JIT 创建 |
| 开放重定向 | 钓鱼攻击 | `SOCIAL_AUTH_SANITIZE_REDIRECTS=True`；`next` 同源校验 |
| Token 中转泄露 | 会话劫持 | access_token 仅后端内存；全链路 HTTPS；HSTS |
| JIT 创建用户涌入 | 未授权用户进入 | `jit_create_user` 可关闭；改为「管理员预创建 + OAuth2 关联」模式 |
| 现有用户密码迁移 | 用户无法登录 | 不动现有密码；OAuth2 用户单独走 `set_unusable_password` |
| 多 IdP 用户身份冲突 | 一个用户多个本地账号 | 强制 `link_by_email`；或要求用户名（sub）唯一 |
| IdP 用户删除后 LS 残留 | 僵尸账号 | 定期对账（可选，通过 IdP 的 SCIM 或定时任务）；停用而非删除 |
| Enterprise 版本可能已有 SSO | 重复造轮子 | 通过 `settings.AUTHENTICATION_BACKENDS`、`MIXIN` 留扩展点；与 LSE 团队对齐 |

---

## 附：与 django-allauth 的差异（备选方案）

若选择 django-allauth 替代 social-django，主要差异：

| 维度 | social-django | django-allauth |
| --- | --- | --- |
| 账号关联模型 | `social_auth_usersocialauth` | `socialaccount_socialaccount` |
| 配置方式 | settings + DB | settings + DB（`SocialApp` 模型） |
| Pipeline | `SOCIAL_AUTH_PIPELINE` | `ACCOUNT_ADAPTER` |
| URL 路由 | 自定义 | `/accounts/` 前缀 |
| 模板 | 自定义 | 内置一套 |
| 迁移成本 | 较低 | 中等 |

本计划的架构与 pipeline 设计可平移到 django-allauth，仅需替换模型名与适配器方法。

---

## 附：参考文件索引

| 主题 | 文件 |
| --- | --- |
| 现有认证授权分析 | [../aaa/AuthenticationAndAuthorization.md](../aaa/AuthenticationAndAuthorization.md) |
| 账号与权限管理计划 | [../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md) |
| 用户模型 | [users/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/models.py) |
| 用户视图 | [users/views.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/views.py) |
| 用户 API | [users/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/api.py) |
| 注册保存逻辑 | [users/functions/common.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/users/functions/common.py) |
| JWT 认证 | [jwt_auth/auth.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/auth.py) |
| JWT 中间件 | [jwt_auth/middleware.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/middleware.py) |
| JWT 模型 | [jwt_auth/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/models.py) |
| JWT 视图 | [jwt_auth/views.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth/views.py) |
| 组织模型 | [organizations/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/organizations/models.py) |
| 会话超时策略 | [session_policy/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/session_policy/models.py) |
| 全局设置 | [core/settings/base.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py) |
| 中间件 | [core/middleware.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/middleware.py) |
| 特性开关 | [core/feature_flags](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/feature_flags) |
| 项目整体架构 | [../project/PROJECT.md](../project/PROJECT.md) |
