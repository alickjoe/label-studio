# 工作流功能增强计划

> 本文档面向在当前 Label Studio 项目中**引入完整的工作流（Workflow）能力**的实施人员，给出从现状分析、选型推荐、数据模型、管理页面、实际应用、迁移测试到里程碑的完整落地计划。
>
> - 目标读者：后端工程师、前端工程师、ML 工程师、标注团队管理者
> - 适用版本：基于当前仓库 `c:\Users\yystj\work\label-studio\label-studio`
> - 配套文档：[../project/PROJECT.md](../project/PROJECT.md)（整体架构）、[../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md)（账号与权限）

---

## 目录

1. [目标与范围](#1-目标与范围)
2. [现状分析](#2-现状分析)
3. [工作流选型推荐](#3-工作流选型推荐)
4. [总体设计](#4-总体设计)
5. [数据模型设计](#5-数据模型设计)
6. [后端实现计划](#6-后端实现计划)
7. [前端管理页面](#7-前端管理页面)
8. [工作流实际应用](#8-工作流实际应用)
9. [与现有 FSM 的关系](#9-与现有-fsm-的关系)
10. [迁移与兼容策略](#10-迁移与兼容策略)
11. [测试计划](#11-测试计划)
12. [里程碑与交付物](#12-里程碑与交付物)
13. [风险与对策](#13-风险与对策)

---

## 1. 目标与范围

### 1.1 业务目标

在当前项目中增加可视化的工作流能力，使标注团队能够：

1. **定义工作流**：通过模板或可视化编辑器定义标注流程（如「标注 → 审核 → 验收」）
2. **管理页面**：在工作流管理页面查看、创建、编辑、复制、启用/停用工作流
3. **绑定项目**：将工作流绑定到项目，使项目内任务按工作流推进
4. **任务流转**：任务在节点间自动或手动流转，节点可分配角色与处理人
5. **状态追踪**：可视化查看每个任务当前所处节点、历史轨迹
6. **实际应用**：覆盖串行流水线、多人并行标注、主动学习闭环、条件路由等典型场景

### 1.2 范围界定

| 类别 | 包含 | 不包含 |
| --- | --- | --- |
| 工作流定义 | 节点、转移、条件、角色分配 | BPMN 2.0 完整规范、子流程嵌套 |
| 工作流引擎 | 状态推进、条件路由、超时提醒 | 复杂的并行网关、事件子流程 |
| 管理页面 | 工作流列表、可视化编辑器、绑定项目、运行监控 | 工作流版本对比、回滚 |
| 任务流转 | 任务在节点间流转、分配、回收 | 跨项目任务流转 |
| 通知 | 节点进入时的 Webhook、站内信 | 邮件/短信通知（沿用现有 Webhook） |
| 集成 | 与现有 FSM、Data Manager、ML Backend、Webhook 集成 | 与外部 BPM 系统（Camunda/Activiti）集成 |
| 模板 | 内置 5+ 工作流模板 | 模板市场、社区共享 |

### 1.3 核心业务流程

```text
管理员 → 工作流管理页 → 选择模板或新建 → 可视化编辑器配置节点/转移
   ↓
绑定到项目 → 项目内任务按工作流推进
   ↓
任务进入「标注」节点 → 分配给标注员 → 提交标注
   ↓
按转移条件路由 → 进入「审核」节点 → 分配给审核员 → 通过/驳回
   ↓
进入「验收」节点 → 验收完成 → 工作流结束
```

---

## 2. 现状分析

### 2.1 已具备的能力

经源码梳理，当前项目已具备与工作流相关的基础设施：

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| **FSM 框架** | [fsm/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm) | 高性能有限状态机，UUID7 优化，声明式转移 |
| FSM 状态模型 | [fsm/state_models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_models.py) | `TaskState`、`AnnotationState`、`ProjectState` |
| FSM 状态枚举 | [fsm/state_choices.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_choices.py) | Task: CREATED/IN_PROGRESS/COMPLETED；Project: 同 |
| FSM 转移定义 | [fsm/project_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/project_transitions.py)、[task_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/task_transitions.py)、[annotation_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/annotation_transitions.py) | 声明式转移，含 pre/post hooks |
| StateManager | [fsm/state_manager.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_manager.py) | 主要扩展点，`execute_transition()` |
| 注册系统 | [fsm/registry.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/registry.py) | 状态模型、转移、状态枚举的动态注册 |
| Data Manager 视图 | [data_manager/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/models.py) | `View` 含 filters、ordering、tabs、actions |
| Next Task 动作 | [data_manager/actions/next_task.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/actions/next_task.py) | 任务采样分配逻辑 |
| 任务锁 | [projects/README.md](file:///c:/Users/yystj/work/udio/label-studio/label-studio/label_studio/projects/README.md) | `TaskLock` 防止多人同时标注同一任务 |
| Webhook | [webhooks/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/webhooks) | 项目级事件订阅，可触发外部系统 |
| ML Backend | [ml/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/ml) | 预标注、在线推理、模型训练 |
| 项目成员 | [projects/models.py `ProjectMember`](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py#L1396) | 可扩展为节点处理人（见授权计划） |
| 业务工作流图 | [../project/images/workflow.svg](../project/images/workflow.svg) | 现有业务闭环：创建→配置→导入→标注→质检→导出 |

### 2.2 主要差距

| 差距 | 影响 |
| --- | --- |
| FSM 状态枚举固定（CREATED/IN_PROGRESS/COMPLETED） | 无法表达「待审核」「待验收」「已驳回」等多阶段标注流程 |
| FSM 转移为代码硬编码 | 无法由管理员在 UI 上自定义流程；每次改流程需发版 |
| 无工作流定义模型 | 无法存储「工作流模板」「工作流实例」「节点定义」 |
| 无节点处理人分配 | 任务无法按节点自动分配给特定角色/用户 |
| 无条件路由 | 无法根据标注结果（如置信度、标签值）路由到不同节点 |
| 无可视化编辑器 | 管理员只能改代码，无法自助配置流程 |
| 无工作流运行监控 | 无法查看「哪些任务卡在审核节点」「平均审核耗时」 |
| Data Manager 与 FSM 状态脱节 | 视图可按 `is_labeled` 过滤，但不能按 FSM 状态过滤 |

### 2.3 现有 FSM 状态流转

```text
Task:     CREATED ──(annotation_created)──> COMPLETED
                                  ▲
                                  │
                            (annotations_deleted)
                                  │
            COMPLETED ───────────┘ (回退到 IN_PROGRESS)

Project:  CREATED ──(first annotation)──> IN_PROGRESS ──(all tasks done)──> COMPLETED
                          ▲                                                  │
                          └────────(task incomplete)─────────────────────────┘
```

**结论**：现有 FSM 适合「单阶段标注 + 完成」的简单场景，无法支撑多阶段、多角色、条件路由的复杂工作流。需在工作流层扩展，FSM 作为底层引擎保留。

---

## 3. 工作流选型推荐

### 3.1 候选方案对比

| 方案 | 描述 | 优点 | 缺点 | 推荐度 |
| --- | --- | --- | --- | --- |
| A. 扩展现有 FSM | 在 `TaskStateChoices` 增加状态枚举，硬编码转移 | 改动小，复用现有引擎 | 无法动态配置，每次改流程需发版 | ★★ |
| B. 引入外部 BPMN 引擎（Camunda/Activiti） | 集成成熟的工作流引擎 | 功能完整、规范 | 引入 JVM 依赖、架构复杂、与 Django 生态不匹配 | ★ |
| C. 自研轻量工作流引擎（基于现有 FSM） | 新增 `Workflow`/`WorkflowNode`/`WorkflowTransition` 模型，复用 FSM 的 StateManager 持久化状态 | 灵活、与项目深度集成、可可视化编辑 | 需自研引擎，工作量中等 | ★★★★★ |
| D. 基于数据管理器 View 模拟 | 用 View 的 filter 模拟节点（如「待审核」= `is_labeled=True & ...`） | 零新代码 | 仅能过滤，无法驱动流转、无法分配处理人 | ★★ |

### 3.2 推荐：方案 C — 自研轻量工作流引擎

**理由**：

1. **复用现有 FSM 基础设施**：`StateManager`、UUID7 优化、注册系统均已就绪，只需扩展状态枚举与转移定义机制
2. **与项目深度集成**：可直接复用 `ProjectMember`、`TaskLock`、`Webhook`、`ML Backend`、`Data Manager`
3. **可视化友好**：节点/转移模型天然适合前端可视化编辑器（React Flow / x6）
4. **避免外部依赖**：不引入 JVM，不增加运维复杂度，符合 OSS 单包分发定位
5. **渐进式**：可作为 FSM 之上的「编排层」，未启用工作流的项目沿用原 FSM 行为

### 3.3 工作流引擎能力边界

| 支持 | 不支持 |
| --- | --- |
| 顺序节点（标注→审核→验收） | 子流程嵌套 |
| 条件路由（按标注字段/置信度） | 复杂并行网关（AND/XOR） |
| 角色分配（按 ProjectMember 角色） | 跨组织处理人 |
| 循环（驳回回到标注） | 中断事件 |
| 超时提醒（通过 Webhook） | 定时器事件 |
| 并行标注（同节点多人独立标注） | 动态创建节点 |

---

## 4. 总体设计

### 4.1 设计原则

1. **FSM 为底，工作流为上**：FSM 负责状态持久化与历史，工作流负责编排与路由
2. **项目级绑定**：一个项目绑定一个工作流；工作流可被多项目复用
3. **模板优先**：提供开箱即用模板，覆盖 80% 场景；可视化编辑器满足长尾
4. **特性开关**：通过 `feat_workflow` 控制启用，未启用的项目沿用原 FSM
5. **API 优先**：所有能力通过 REST API 暴露，前端只消费 API
6. **可观测**：每个任务的工作流状态、历史、处理人全程可查

### 4.2 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│                       前端（React）                          │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ 工作流列表页 │ │ 可视化编辑器  │ │ 工作流运行监控页    │   │
│  │ (ListPage)  │ │ (Editor)     │ │ (MonitorPage)      │   │
│  └──────┬──────┘ └──────┬───────┘ └─────────┬──────────┘   │
│         └───────────────┼───────────────────┘              │
│                         ▼                                  │
│           /api/workflows/ /api/projects/{id}/workflow       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 后端（Django + DRF）                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ workflows app    │  │ fsm app（现有）   │                │
│  │ - Workflow        │  │ - StateManager   │                │
│  │ - WorkflowNode    │  │ - TaskState      │                │
│  │ - WorkflowTrans   │  │ - 转移执行        │                │
│  │ - WorkflowInstance│  └──────────────────┘                │
│  │ - 引擎执行器       │                                      │
│  └────────┬─────────┘                                      │
│           ▼                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ data_manager     │  │ webhooks         │                │
│  │ - 按 WF 节点过滤  │  │ - 节点进入事件    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              数据层（SQLite/PG）                             │
│  workflow · workflow_node · workflow_transition             │
│  workflow_instance · workflow_task_assignment               │
│  + 现有 fsm_taskstate 等                                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 工作流与 FSM 的分层关系

```text
┌─────────────────────────────────────────────┐
│  工作流层（Workflow Layer）                  │
│  - Workflow: 标注→审核→验收                  │
│  - WorkflowNode: 标注节点、审核节点          │
│  - WorkflowTransition: 提交、通过、驳回       │
│  - 引擎执行器：解析转移、路由、分配           │
└──────────────────┬──────────────────────────┘
                   │ 调用
                   ▼
┌─────────────────────────────────────────────┐
│  FSM 层（Finite State Machine）             │
│  - TaskState: 待标注/待审核/待验收/已完成    │
│  - StateManager.execute_transition()         │
│  - UUID7 优化、历史记录、缓存                │
└─────────────────────────────────────────────┘
```

---

## 5. 数据模型设计

### 5.1 新增 `workflows` app

在 `label_studio/workflows/` 新建 app，并加入 `INSTALLED_APPS`（在 `fsm` 之后）。

### 5.2 核心模型

#### 5.2.1 `Workflow`（工作流定义）

```python
# label_studio/workflows/models.py
class Workflow(models.Model):
    """工作流定义，可被多个项目复用"""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Draft')
        PUBLISHED = 'PUBLISHED', _('Published')
        ARCHIVED = 'ARCHIVED', _('Archived')

    title = models.CharField(max_length=255, help_text='工作流名称')
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    version = models.PositiveIntegerField(default=1, help_text='版本号，每次发布自增')
    graph = models.JSONField(default=dict, help_text='可视化编辑器的图形数据（节点位置等）')
    config = models.JSONField(default=dict, help_text='工作流级配置（超时、重试等）')

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='workflows'
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', '-updated_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['organization', 'title', 'version'], name='unique_workflow_title_version'),
        ]
```

#### 5.2.2 `WorkflowNode`（节点定义）

```python
class WorkflowNode(models.Model):
    """工作流节点，对应一个处理阶段"""

    class Kind(models.TextChoices):
        START = 'START', _('Start')           # 起点
        ANNOTATION = 'ANNOTATION', _('Annotation')  # 标注节点
        REVIEW = 'REVIEW', _('Review')        # 审核节点
        ACCEPTANCE = 'ACCEPTANCE', _('Acceptance')  # 验收节点
        ML_PREDICTION = 'ML_PREDICTION', _('ML Prediction')  # ML 预标注节点
        CONDITION = 'CONDITION', _('Condition')  # 条件路由节点
        END = 'END', _('End')                 # 终点

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='nodes')
    key = models.CharField(max_length=50, help_text='节点唯一标识，如 "annotate"')
    name = models.CharField(max_length=255, help_text='节点显示名称')
    kind = models.CharField(max_length=20, choices=Kind.choices)
    order = models.PositiveIntegerField(default=0, help_text='同类型节点排序')

    # 处理人分配
    assignee_role = models.CharField(
        max_length=20, blank=True, default='',
        help_text='按项目角色分配（VIEWER/EDITOR），留空表示不自动分配',
    )
    assignee_user_ids = models.JSONField(
        default=list, help_text='指定用户 ID 列表（候选处理人）'
    )
    assignment_strategy = models.CharField(
        max_length=20, default='ROUND_ROBIN',
        help_text='分配策略：ROUND_ROBIN 轮询 / LEAST_LOADED 最少负载 / MANUAL 手动',
    )

    # 节点配置
    config = models.JSONField(default=dict, help_text='节点配置（如：标注节点可指定 label_config 片段）')

    # FSM 状态映射
    fsm_state = models.CharField(
        max_length=50, blank=True, default='',
        help_text='该节点对应的 TaskState 值（如 PENDING_REVIEW）',
    )

    class Meta:
        indexes = [
            models.Index(fields=['workflow', 'kind']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['workflow', 'key'], name='unique_node_key'),
        ]
```

#### 5.2.3 `WorkflowTransition`（转移定义）

```python
class WorkflowTransition(models.Model):
    """工作流转移，定义节点间的流转规则"""

    class Trigger(models.TextChoices):
        MANUAL = 'MANUAL', _('Manual')            # 手动触发（如「提交审核」按钮）
        ON_SUBMIT = 'ON_SUBMIT', _('On Submit')   # 标注提交自动触发
        ON_APPROVE = 'ON_APPROVE', _('On Approve')
        ON_REJECT = 'ON_REJECT', _('On Reject')
        AUTO = 'AUTO', _('Auto')                  # 进入源节点即自动转移

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='transitions')
    from_node = models.ForeignKey(WorkflowNode, on_delete=models.CASCADE, related_name='outgoing_transitions')
    to_node = models.ForeignKey(WorkflowNode, on_delete=models.CASCADE, related_name='incoming_transitions')
    name = models.CharField(max_length=255, help_text='转移显示名称（如「提交审核」「驳回」）')
    trigger = models.CharField(max_length=20, choices=Trigger.choices, default=Trigger.MANUAL)

    # 条件表达式（Python 表达式，沙箱执行）
    condition = models.TextField(
        blank=True, default='',
        help_text='条件表达式，如 "annotation.result[0].value.confidence > 0.9"',
    )

    class Meta:
        indexes = [
            models.Index(fields=['workflow', 'from_node']),
            models.Index(fields=['workflow', 'to_node']),
        ]
```

#### 5.2.4 `ProjectWorkflow`（项目-工作流绑定）

```python
class ProjectWorkflow(models.Model):
    """项目与工作流的绑定关系（一个项目同一时刻只能绑定一个已发布工作流）"""

    project = models.OneToOneField('projects.Project', on_delete=models.CASCADE, related_name='workflow_binding')
    workflow = models.ForeignKey(Workflow, on_delete=models.PROTECT, related_name='project_bindings')
    workflow_version = models.PositiveIntegerField(help_text='绑定时的版本号（用于审计）')
    is_active = models.BooleanField(default=True)
    bound_at = models.DateTimeField(auto_now_add=True)
    bound_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    class Meta:
        indexes = [models.Index(fields=['project', 'is_active'])]
```

#### 5.2.5 `WorkflowTaskAssignment`（任务分配记录）

```python
class WorkflowTaskAssignment(models.Model):
    """任务在某节点的分配记录（一个任务在一个节点可被分配多次，如驳回后重新分配）"""

    class Status(models.TextChoices):
        ASSIGNED = 'ASSIGNED', _('Assigned')
        IN_PROGRESS = 'IN_PROGRESS', _('In Progress')
        COMPLETED = 'COMPLETED', _('Completed')
        RETURNED = 'RETURNED', _('Returned')  # 被回收或驳回

    task = models.ForeignKey('tasks.Task', on_delete=models.CASCADE, related_name='workflow_assignments')
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='workflow_assignments')
    workflow = models.ForeignKey(Workflow, on_delete=models.PROTECT)
    node = models.ForeignKey(WorkflowNode, on_delete=models.PROTECT)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ASSIGNED)
    assigned_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    result = models.JSONField(default=dict, help_text='处理结果（如审核意见、驳回原因）')

    class Meta:
        indexes = [
            models.Index(fields=['task', 'node', '-assigned_at']),
            models.Index(fields=['assignee', 'status']),
            models.Index(fields=['project', 'node', 'status']),
        ]
```

### 5.3 扩展 `TaskStateChoices`

在 [fsm/state_choices.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_choices.py) 扩展任务状态：

```python
@register_state_choices('task')
class TaskStateChoices(models.TextChoices):
    # 现有
    CREATED = 'CREATED', _('Created')
    IN_PROGRESS = 'IN_PROGRESS', _('In Progress')
    COMPLETED = 'COMPLETED', _('Completed')
    # 新增（工作流相关）
    PENDING_ANNOTATION = 'PENDING_ANNOTATION', _('Pending Annotation')
    PENDING_REVIEW = 'PENDING_REVIEW', _('Pending Review')
    PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE', _('Pending Acceptance')
    REJECTED = 'REJECTED', _('Rejected')
    CANCELLED = 'CANCELLED', _('Cancelled')
```

> 说明：保留现有 3 个状态以兼容未启用工作流的项目；新增状态仅在 `feat_workflow` 开启时使用。

### 5.4 ER 关系

```text
┌────────────┐         ┌──────────────────┐
│ organization│ 1───N   │    workflow       │
└────────────┘◄────────┤ - id             │
                      │ - title          │
                      │ - version        │
                      │ - status         │
                      └────────┬─────────┘
                               │ 1
                               │ N
                  ┌────────────┴────────────┐
                  │                         │
                  ▼ N                       ▼ N
        ┌──────────────────┐      ┌──────────────────────┐
        │ workflow_node    │      │ workflow_transition  │
        │ - workflow_id    │      │ - workflow_id        │
        │ - key, name      │      │ - from_node_id       │
        │ - kind           │      │ - to_node_id         │
        │ - assignee_role  │      │ - trigger            │
        │ - fsm_state      │      │ - condition          │
        └──────────────────┘      └──────────────────────┘
                  ▲
                  │
                  │ N
        ┌─────────┴──────────┐
        │ project_workflow   │ 1:1 ── project
        │ - project_id       │
        │ - workflow_id      │
        │ - is_active        │
        └────────────────────┘
                  ▲
                  │
                  │ N
        ┌─────────┴──────────────┐
        │ workflow_task_assignment│ N:1 ── task
        │ - task_id               │ N:1 ── user (assignee)
        │ - node_id               │
        │ - assignee_id           │
        │ - status                │
        └─────────────────────────┘
```

---

## 6. 后端实现计划

### 6.1 新增文件清单

| 文件 | 说明 |
| --- | --- |
| `label_studio/workflows/__init__.py` | app 初始化 |
| `label_studio/workflows/apps.py` | AppConfig |
| `label_studio/workflows/models.py` | 上述 5 个模型 |
| `label_studio/workflows/migrations/0001_initial.py` | 初始迁移 |
| `label_studio/workflows/serializers.py` | 序列化器 |
| `label_studio/workflows/api.py` | DRF ViewSet |
| `label_studio/workflows/urls.py` | 路由 |
| `label_studio/workflows/engine.py` | 工作流引擎核心 |
| `label_studio/workflows/executor.py` | 转移执行器（调用 FSM） |
| `label_studio/workflows/condition_evaluator.py` | 条件表达式沙箱执行 |
| `label_studio/workflows/assignment.py` | 处理人分配策略 |
| `label_studio/workflows/templates.py` | 内置模板定义 |
| `label_studio/workflows/signals.py` | 信号（任务进入节点时触发 Webhook） |
| `label_studio/workflows/apps.py` | 注册信号、检查 INSTALLED_APPS 顺序 |

### 6.2 修改的现有文件

| 文件 | 改动 |
| --- | --- |
| [core/settings/base.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py) | `INSTALLED_APPS` 加 `workflows`（在 `fsm` 之后）；加 `feat_workflow` 开关 |
| [fsm/state_choices.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_choices.py) | 扩展 `TaskStateChoices` |
| [tasks/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tasks/api.py) | 标注提交时触发工作流转移 |
| [data_manager/functions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/functions.py) | 增加「按工作流节点过滤」的 filter |
| [webhooks/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/webhooks/models.py) | 新增 `workflow.node.entered` 事件类型 |

### 6.3 API 设计

#### 6.3.1 工作流 CRUD `/api/workflows/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/workflows/?status=&search=` | `workflows_view` | 列出工作流 |
| POST | `/api/workflows/` | `workflows_change` | 创建（可从模板创建） |
| GET | `/api/workflows/{id}/` | `workflows_view` | 详情（含 nodes、transitions） |
| PATCH | `/api/workflows/{id}/` | `workflows_change` | 修改（仅 DRAFT 状态） |
| DELETE | `/api/workflows/{id}/` | `workflows_change` | 删除（仅未被绑定） |
| POST | `/api/workflows/{id}/publish/` | `workflows_change` | 发布（DRAFT → PUBLISHED，版本+1） |
| POST | `/api/workflows/{id}/clone/` | `workflows_change` | 复制为新 DRAFT |
| GET | `/api/workflows/templates/` | `workflows_view` | 列出内置模板 |
| POST | `/api/workflows/from-template/` | `workflows_change` | 从模板创建 |

#### 6.3.2 项目工作流绑定 `/api/projects/{project_id}/workflow/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/projects/{project_id}/workflow/` | `projects_view` | 查看绑定 |
| POST | `/api/projects/{project_id}/workflow/bind/` | `projects_change` | 绑定工作流 |
| DELETE | `/api/projects/{project_id}/workflow/` | `projects_change` | 解绑 |
| GET | `/api/projects/{project_id}/workflow/monitor/` | `projects_view` | 运行监控（各节点任务数、平均耗时） |

#### 6.3.3 任务工作流操作 `/api/tasks/{task_id}/workflow/`

| 方法 | 端点 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/tasks/{task_id}/workflow/` | `tasks_view` | 查看当前节点、历史 |
| POST | `/api/tasks/{task_id}/workflow/transition/` | `tasks_change` | 执行转移（如提交审核） |
| GET | `/api/tasks/{task_id}/workflow/available-transitions/` | `tasks_view` | 可用转移（用于按钮渲染） |
| POST | `/api/tasks/{task_id}/workflow/assign/` | `tasks_change` | 手动分配处理人 |

请求示例（执行转移）：

```json
POST /api/tasks/123/workflow/transition/
{
  "transition_id": 45,
  "result": { "comment": "标注完成，请审核" }
}
```

响应：

```json
{
  "task_id": 123,
  "from_node": { "key": "annotate", "name": "标注" },
  "to_node": { "key": "review", "name": "审核" },
  "assignee_id": 42,
  "assignment_id": 789,
  "fsm_state": "PENDING_REVIEW"
}
```

### 6.4 工作流引擎核心

```python
# label_studio/workflows/engine.py
class WorkflowEngine:
    """工作流引擎，负责解析工作流定义、执行转移、分配处理人"""

    @classmethod
    def start_workflow(cls, task, user=None):
        """任务进入工作流的起点节点"""
        binding = ProjectWorkflow.objects.get(project=task.project, is_active=True)
        start_node = binding.workflow.nodes.get(kind=WorkflowNode.Kind.START)
        next_node = cls._get_next_node(start_node, task)
        cls._enter_node(task, next_node, user)

    @classmethod
    def execute_transition(cls, task, transition, user=None, result=None):
        """执行转移：从 from_node 到 to_node"""
        from fsm.state_manager import StateManager
        from fsm.task_transitions import register_workflow_transitions

        # 1. 校验当前节点
        current_assignment = cls._get_current_assignment(task)
        if current_assignment.node != transition.from_node:
            raise ValidationError('当前节点不匹配')

        # 2. 校验条件
        if transition.condition and not ConditionEvaluator.evaluate(
            transition.condition, task=task, result=result
        ):
            raise ValidationError('转移条件不满足')

        # 3. 关闭当前分配
        current_assignment.status = WorkflowTaskAssignment.Status.COMPLETED
        current_assignment.completed_at = timezone.now()
        current_assignment.result = result or {}
        current_assignment.save()

        # 4. 进入下一节点
        cls._enter_node(task, transition.to_node, user)

        # 5. 触发 Webhook
        signals.task_node_entered.send(
            sender=cls, task=task, node=transition.to_node, user=user
        )

    @classmethod
    def _enter_node(cls, task, node, user=None):
        """进入节点：更新 FSM 状态、分配处理人"""
        from fsm.state_manager import StateManager

        # 更新 TaskState
        if node.fsm_state:
            StateManager.execute_transition(
                entity=task,
                transition_name=f'task_to_{node.fsm_state.lower()}',
                user=user,
            )

        # 创建分配记录
        assignee = AssignmentStrategy.assign(task, node)
        assignment = WorkflowTaskAssignment.objects.create(
            task=task, project=task.project, workflow=node.workflow,
            node=node, assignee=assignee,
            status=WorkflowTaskAssignment.Status.ASSIGNED,
        )

        # 自动触发转移（如 AUTO 触发器）
        auto_transitions = node.outgoing_transitions.filter(
            trigger=WorkflowTransition.Trigger.AUTO
        )
        for t in auto_transitions:
            if not t.condition or ConditionEvaluator.evaluate(t.condition, task=task):
                cls.execute_transition(task, t, user)
                break

        return assignment
```

### 6.5 条件表达式沙箱

```python
# label_studio/workflows/condition_evaluator.py
class ConditionEvaluator:
    """安全地执行工作流转移条件表达式"""

    SAFE_BUILTINS = {
        'len': len, 'str': str, 'int': int, 'float': float,
        'bool': bool, 'list': list, 'dict': dict, 'abs': abs,
        'min': min, 'max': max, 'sum': sum, 'round': round,
    }

    @classmethod
    def evaluate(cls, expression: str, **context) -> bool:
        """
        在受限环境中执行表达式。
        context 包含：task, annotation, result, project, user 等
        """
        if not expression or not expression.strip():
            return True
        try:
            # 编译并限制全局命名空间
            code = compile(expression, '<condition>', 'eval')
            globals_dict = {'__builtins__': cls.SAFE_BUILTINS}
            locals_dict = context
            return bool(eval(code, globals_dict, locals_dict))  # noqa: S307 受控执行
        except Exception as e:
            logger.warning(f'条件表达式执行失败: {expression}, error: {e}')
            return False
```

> 安全说明：条件表达式仅由管理员配置，但仍需在沙箱中执行。`SAFE_BUILTINS` 仅暴露纯函数，禁止 `__import__`、`open` 等。生产环境建议额外用 `ast` 解析校验表达式不含危险节点（Call/Attribute 访问受控）。

### 6.6 处理人分配策略

```python
# label_studio/workflows/assignment.py
class AssignmentStrategy:
    @classmethod
    def assign(cls, task, node) -> Optional[User]:
        if node.assignment_strategy == 'MANUAL':
            return None  # 等待手动分配

        candidates = cls._get_candidates(task, node)
        if not candidates:
            return None

        if node.assignment_strategy == 'ROUND_ROBIN':
            return cls._round_robin(node, candidates)
        elif node.assignment_strategy == 'LEAST_LOADED':
            return cls._least_loaded(node, candidates)
        return candidates[0]

    @classmethod
    def _get_candidates(cls, task, node):
        # 1. 优先按指定用户 ID
        if node.assignee_user_ids:
            return list(User.objects.filter(id__in=node.assignee_user_ids, is_active=True))
        # 2. 按 ProjectMember 角色
        if node.assignee_role:
            from projects.models import ProjectMember
            return list(User.objects.filter(
                project_memberships__project=task.project,
                project_memberships__role=node.assignee_role,
                project_memberships__enabled=True,
                is_active=True,
            ))
        return []
```

### 6.7 内置工作流模板

```python
# label_studio/workflows/templates.py
BUILTIN_TEMPLATES = [
    {
        'key': 'simple_annotation',
        'title': '简单标注',
        'description': '单标注员直接标注并完成',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'annotate', 'name': '标注', 'kind': 'ANNOTATION', 'assignee_role': 'EDITOR'},
            {'key': 'end', 'name': '结束', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'annotate', 'trigger': 'AUTO'},
            {'from': 'annotate', 'to': 'end', 'trigger': 'ON_SUBMIT'},
        ],
    },
    {
        'key': 'annotation_review',
        'title': '标注-审核',
        'description': '标注员标注 → 审核员审核 → 通过/驳回',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'annotate', 'name': '标注', 'kind': 'ANNOTATION', 'assignee_role': 'EDITOR'},
            {'key': 'review', 'name': '审核', 'kind': 'REVIEW', 'assignee_role': 'ADMIN'},
            {'key': 'end', 'name': '完成', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'annotate', 'trigger': 'AUTO'},
            {'from': 'annotate', 'to': 'review', 'trigger': 'ON_SUBMIT', 'name': '提交审核'},
            {'from': 'review', 'to': 'end', 'trigger': 'ON_APPROVE', 'name': '通过'},
            {'from': 'review', 'to': 'annotate', 'trigger': 'ON_REJECT', 'name': '驳回'},
        ],
    },
    {
        'key': 'annotation_review_acceptance',
        'title': '标注-审核-验收',
        'description': '三阶段：标注 → 审核 → 验收',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'annotate', 'name': '标注', 'kind': 'ANNOTATION', 'assignee_role': 'EDITOR'},
            {'key': 'review', 'name': '审核', 'kind': 'REVIEW', 'assignee_role': 'ADMIN'},
            {'key': 'acceptance', 'name': '验收', 'kind': 'ACCEPTANCE', 'assignee_role': 'ADMIN'},
            {'key': 'end', 'name': '完成', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'annotate', 'trigger': 'AUTO'},
            {'from': 'annotate', 'to': 'review', 'trigger': 'ON_SUBMIT', 'name': '提交审核'},
            {'from': 'review', 'to': 'acceptance', 'trigger': 'ON_APPROVE', 'name': '通过'},
            {'from': 'review', 'to': 'annotate', 'trigger': 'ON_REJECT', 'name': '驳回'},
            {'from': 'acceptance', 'to': 'end', 'trigger': 'ON_APPROVE', 'name': '验收通过'},
            {'from': 'acceptance', 'to': 'annotate', 'trigger': 'ON_REJECT', 'name': '退回重标'},
        ],
    },
    {
        'key': 'parallel_annotation',
        'title': '多人并行标注',
        'description': '多标注员独立标注同一任务，用于一致性比对',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'annotate', 'name': '并行标注', 'kind': 'ANNOTATION',
             'assignee_role': 'EDITOR', 'config': {'overlap': 3}},
            {'key': 'end', 'name': '完成', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'annotate', 'trigger': 'AUTO'},
            {'from': 'annotate', 'to': 'end', 'trigger': 'ON_SUBMIT',
             'condition': 'task.total_annotations >= 3'},
        ],
    },
    {
        'key': 'active_learning',
        'title': '主动学习闭环',
        'description': 'ML 预标注 → 人工修正 → 触发训练 → 新一轮预标注',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'predict', 'name': 'ML 预标注', 'kind': 'ML_PREDICTION',
             'config': {'ml_backend': 'auto'}},
            {'key': 'annotate', 'name': '人工修正', 'kind': 'ANNOTATION',
             'assignee_role': 'EDITOR'},
            {'key': 'end', 'name': '完成', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'predict', 'trigger': 'AUTO'},
            {'from': 'predict', 'to': 'annotate', 'trigger': 'AUTO',
             'condition': 'annotation.result and annotation.result[0].value.confidence < 0.95'},
            {'from': 'predict', 'to': 'end', 'trigger': 'AUTO',
             'condition': 'annotation.result and annotation.result[0].value.confidence >= 0.95'},
            {'from': 'annotate', 'to': 'end', 'trigger': 'ON_SUBMIT'},
        ],
    },
    {
        'key': 'conditional_routing',
        'title': '条件路由',
        'description': '根据标注结果路由到不同处理路径',
        'nodes': [
            {'key': 'start', 'name': '开始', 'kind': 'START'},
            {'key': 'classify', 'name': '分类', 'kind': 'ANNOTATION',
             'assignee_role': 'EDITOR'},
            {'key': 'high_priority_review', 'name': '高优先级审核', 'kind': 'REVIEW',
             'assignee_role': 'ADMIN'},
            {'key': 'normal_review', 'name': '常规审核', 'kind': 'REVIEW',
             'assignee_role': 'ADMIN'},
            {'key': 'end', 'name': '完成', 'kind': 'END'},
        ],
        'transitions': [
            {'from': 'start', 'to': 'classify', 'trigger': 'AUTO'},
            {'from': 'classify', 'to': 'high_priority_review', 'trigger': 'ON_SUBMIT',
             'name': '高优先级', 'condition': 'annotation.result[0].value.labels[0] == "urgent"'},
            {'from': 'classify', 'to': 'normal_review', 'trigger': 'ON_SUBMIT',
             'name': '常规', 'condition': 'annotation.result[0].value.labels[0] != "urgent"'},
            {'from': 'high_priority_review', 'to': 'end', 'trigger': 'ON_APPROVE'},
            {'from': 'normal_review', 'to': 'end', 'trigger': 'ON_APPROVE'},
        ],
    },
]
```

---

## 7. 前端管理页面

### 7.1 路由与页面结构

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/workflows` | `WorkflowListPage` | 工作流列表 |
| `/workflows/new` | `WorkflowEditorPage` | 新建（先选模板） |
| `/workflows/{id}/edit` | `WorkflowEditorPage` | 编辑（可视化） |
| `/workflows/{id}/monitor` | `WorkflowMonitorPage` | 运行监控 |
| `/projects/{id}/settings/workflow` | `ProjectWorkflowSettings` | 项目工作流绑定 |

### 7.2 工作流列表页 `WorkflowListPage`

**位置**：`web/apps/labelstudio/src/pages/Workflows/`

**功能**：

1. 工作流卡片网格（标题、描述、状态、版本、绑定项目数）
2. 筛选：状态（DRAFT/PUBLISHED/ARCHIVED）、搜索
3. 操作：新建（从模板/空白）、编辑、复制、发布、归档、删除
4. 权限：仅组织 ADMIN/OWNER 可见

### 7.3 可视化编辑器 `WorkflowEditorPage`

**位置**：`web/apps/labelstudio/src/pages/Workflows/Editor/`

**技术选型**：[React Flow](https://reactflow.dev/)（轻量、社区活跃、符合 Nx monorepo 生态）

**功能**：

1. 画布：拖拽创建节点、连线定义转移
2. 节点配置面板（右侧抽屉）：
   - 节点类型（START/ANNOTATION/REVIEW/ACCEPTANCE/ML_PREDICTION/CONDITION/END）
   - 显示名称
   - 处理人分配（角色/指定用户/策略）
   - FSM 状态映射
   - 节点配置（如 ML backend 选择、overlap 数）
3. 转移配置面板：
   - 触发器（MANUAL/ON_SUBMIT/ON_APPROVE/ON_REJECT/AUTO）
   - 条件表达式编辑器（带语法高亮、变量提示）
   - 显示名称
4. 顶部工具栏：保存草稿、发布、预览（模拟运行）、从模板导入
5. 校验：起点唯一、终点可达、无悬空节点、条件表达式语法

**组件结构**：

```text
Editor/
├── index.tsx                       # 主页面
├── workflow-canvas.tsx             # React Flow 画布
├── nodes/
│   ├── start-node.tsx
│   ├── annotation-node.tsx
│   ├── review-node.tsx
│   ├── acceptance-node.tsx
│   ├── ml-prediction-node.tsx
│   ├── condition-node.tsx
│   └── end-node.tsx
├── panels/
│   ├── node-config-panel.tsx       # 节点配置抽屉
│   ├── transition-config-panel.tsx # 转移配置抽屉
│   └── template-picker-panel.tsx
├── condition-editor.tsx            # 条件表达式编辑器
└── editor.module.css
```

**节点视觉规范**：

| 节点类型 | 形状 | 颜色 |
| --- | --- | --- |
| START | 圆形 | 绿色 |
| ANNOTATION | 圆角矩形 | 蓝色 |
| REVIEW | 圆角矩形 | 橙色 |
| ACCEPTANCE | 圆角矩形 | 紫色 |
| ML_PREDICTION | 菱形 | 青色 |
| CONDITION | 菱形 | 黄色 |
| END | 圆形 | 灰色 |

### 7.4 工作流运行监控页 `WorkflowMonitorPage`

**位置**：`web/apps/labelstudio/src/pages/Workflows/Monitor/`

**功能**：

1. 工作流图概览（同编辑器，但只读）
2. 每个节点显示：当前任务数、平均处理时长、最长停留时间
3. 任务列表表格：当前节点、处理人、状态、停留时长、操作（查看详情、强制转移）
4. 时间趋势图：近 7 天各节点任务流入/流出量
5. 异常告警：长时间停留的任务高亮

### 7.5 项目工作流绑定页 `ProjectWorkflowSettings`

**位置**：`web/apps/labelstudio/src/pages/Project/Settings/Workflow/`

**功能**：

1. 当前绑定的工作流（只读卡片）
2. 「更换工作流」按钮 → 选择已发布工作流
3. 「解绑」按钮（解绑后任务回到默认 FSM）
4. 绑定后自动将现有任务加入工作流起点（可配置：仅新任务 / 全部任务）
5. 项目内 Data Manager 增加「工作流节点」筛选维度

### 7.6 状态管理

```typescript
// web/apps/labelstudio/src/store/workflows.ts
import { atomWithQuery } from 'jotai-tanstack-query'

export const workflowsAtom = atomWithQuery(() => ({
  queryKey: ['workflows'],
  queryFn: () => workflowsApi.list(),
}))

export const workflowDetailAtom = (id: number) =>
  atomWithQuery(() => ({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.get(id),
  }))

export const projectWorkflowAtom = (projectId: number) =>
  atomWithQuery(() => ({
    queryKey: ['project-workflow', projectId],
    queryFn: () => workflowsApi.getProjectBinding(projectId),
  }))
```

### 7.7 API 客户端

```typescript
// web/libs/app-common/src/api/workflows.ts
export const workflowsApi = {
  list: (params?: { status?: string; search?: string }) => http.get('/api/workflows/', { params }),
  get: (id: number) => http.get(`/api/workflows/${id}/`),
  create: (data: CreateWorkflowPayload) => http.post('/api/workflows/', data),
  update: (id: number, data: Partial<Workflow>) => http.patch(`/api/workflows/${id}/`, data),
  delete: (id: number) => http.delete(`/api/workflows/${id}/`),
  publish: (id: number) => http.post(`/api/workflows/${id}/publish/`),
  clone: (id: number) => http.post(`/api/workflows/${id}/clone/`),
  listTemplates: () => http.get('/api/workflows/templates/'),
  createFromTemplate: (templateKey: string, title: string) =>
    http.post('/api/workflows/from-template/', { template_key: templateKey, title }),
  getProjectBinding: (projectId: number) => http.get(`/api/projects/${projectId}/workflow/`),
  bindProject: (projectId: number, workflowId: number) =>
    http.post(`/api/projects/${projectId}/workflow/bind/`, { workflow_id: workflowId }),
  unbindProject: (projectId: number) => http.delete(`/api/projects/${projectId}/workflow/`),
  getMonitor: (projectId: number) => http.get(`/api/projects/${projectId}/workflow/monitor/`),
  getTaskWorkflow: (taskId: number) => http.get(`/api/tasks/${taskId}/workflow/`),
  getAvailableTransitions: (taskId: number) =>
    http.get(`/api/tasks/${taskId}/workflow/available-transitions/`),
  executeTransition: (taskId: number, transitionId: number, result?: object) =>
    http.post(`/api/tasks/${taskId}/workflow/transition/`, { transition_id: transitionId, result }),
}
```

### 7.8 标注界面集成

在 LSF 编辑器顶部增加工作流操作栏：

- 显示当前节点名称、处理人
- 「提交审核」「通过」「驳回」按钮（根据 `available-transitions` 动态渲染）
- 「驳回原因」输入框（转移时携带 `result`）
- 工作流历史时间线（侧边抽屉）

---

## 8. 工作流实际应用

### 8.1 场景一：单标注员直接标注（最简单）

**适用**：个人标注、内部小团队、数据量小

**配置**：使用「简单标注」模板

```text
START → 标注（EDITOR）→ END
```

**流程**：

1. 项目绑定 `simple_annotation` 工作流
2. 任务导入后自动进入「标注」节点，分配给项目内 EDITOR
3. 标注员提交标注 → 自动流转到 END
4. 任务 `is_labeled=True`，`TaskState=COMPLETED`

### 8.2 场景二：标注-审核两级流水线（推荐）

**适用**：需要质量控制的标注团队

**配置**：使用「标注-审核」模板

```text
START → 标注（EDITOR）──ON_SUBMIT──> 审核（ADMIN）
                                  ├──ON_APPROVE──> END
                                  └──ON_REJECT───> 标注（重新分配）
```

**流程**：

1. 标注员 A 在「标注」节点提交标注 → 任务进入「审核」节点
2. 审核员 B（ADMIN 角色）查看标注，决定：
   - 通过：任务进入 END，`is_labeled=True`
   - 驳回：任务回到「标注」节点，可重新分配给 A 或其他标注员，附带驳回原因
3. Data Manager 中可按「当前节点」筛选，查看待审核任务

**典型拒绝条件示例**：

- 标注框遗漏目标
- 标签分类错误
- 标注精度不达标

### 8.3 场景三：标注-审核-验收三阶段（高质量要求）

**适用**：医疗、法律、金融等高精度领域

**配置**：使用「标注-审核-验收」模板

```text
START → 标注（EDITOR）→ 审核（ADMIN）→ 验收（OWNER）
                                       ├──ON_APPROVE──> END
                                       └──ON_REJECT───> 标注
```

**流程**：

1. 标注员标注 → 审核员审核通过 → 验收员（OWNER）最终验收
2. 任何阶段可驳回回到标注
3. 验收通过后任务 `is_labeled=True`

### 8.4 场景四：多人并行标注（一致性比对）

**适用**：需要计算标注一致性的研究项目

**配置**：使用「多人并行标注」模板，节点 `overlap=3`

```text
START → 并行标注（3 个 EDITOR 独立标注）──condition: total_annotations>=3──> END
```

**流程**：

1. 任务进入「并行标注」节点，同时分配给 3 个标注员
2. 每个标注员独立提交（使用 `TaskLock` 防止冲突）
3. 当 `task.total_annotations >= 3` 时自动进入 END
4. 导出后可计算 Cohen's Kappa 等一致性指标

### 8.5 场景五：主动学习闭环

**适用**：已有初步模型，希望优先标注模型不确定的样本

**配置**：使用「主动学习闭环」模板

```text
START → ML 预标注 ──condition: confidence<0.95──> 人工修正 ──ON_SUBMIT──> END
                └──condition: confidence>=0.95──────────────────────────> END
```

**流程**：

1. 任务进入「ML 预标注」节点，调用 ML Backend 获取预测
2. 若预测置信度 ≥ 0.95，直接进入 END（预标注作为最终结果）
3. 若置信度 < 0.95，进入「人工修正」节点，标注员在预标注基础上修正
4. 提交后进入 END
5. 定期触发 ML 训练，迭代模型

### 8.6 场景六：条件路由

**适用**：根据标注内容分流处理

**配置**：使用「条件路由」模板

```text
START → 分类 ──condition: label=="urgent"──> 高优先级审核 ──ON_APPROVE──> END
            └──condition: label!="urgent"──> 常规审核    ──ON_APPROVE──> END
```

**流程**：

1. 标注员先对任务做分类标注（urgent/normal）
2. 根据标签值路由到不同审核节点
3. 高优先级审核由资深审核员处理，常规审核由普通审核员处理
4. 各自审核通过后进入 END

### 8.7 场景七：跨项目复用工作流

**适用**：多个相似项目共用同一套流程

**流程**：

1. 管理员创建并发布工作流 `W1`
2. 项目 P1、P2、P3 均绑定 `W1`
3. 后续优化流程时，复制 `W1` 为 `W1_v2`，发布后各项目可独立升级
4. `ProjectWorkflow.workflow_version` 记录绑定版本，便于审计

### 8.8 场景八：工作流 + Webhook 外部集成

**配置**：在工作流节点进入时触发 Webhook

```python
# label_studio/workflows/signals.py
@receiver(signals.task_node_entered)
def on_task_node_entered(sender, task, node, user, **kwargs):
    from webhooks.models import Webhook
    from webhooks.serializers import WebhookSerializer
    webhooks = Webhook.objects.filter(project=task.project, is_active=True)
    for hook in webhooks:
        hook.send({
            'event': 'workflow.node.entered',
            'task': task.id,
            'node': node.key,
            'node_name': node.name,
            'assignee': user.id if user else None,
        })
```

**典型用途**：

- 任务进入审核节点 → 通知 IM 群（Slack/钉钉/飞书）
- 任务进入 ML 预标注节点 → 触发外部推理服务
- 任务被驳回 → 邮件通知原标注员
- 任务进入 END → 自动触发导出

---

## 9. 与现有 FSM 的关系

### 9.1 分层职责

| 层 | 职责 | 实现 |
| --- | --- | --- |
| 工作流层 | 编排、路由、处理人分配、业务规则 | `workflows` app（新增） |
| FSM 层 | 状态持久化、历史记录、UUID7 优化 | `fsm` app（现有，扩展） |
| 业务层 | 任务、标注、项目模型 | `tasks`/`projects` app（现有） |

### 9.2 状态映射

工作流节点通过 `WorkflowNode.fsm_state` 字段映射到 FSM 状态：

| 工作流节点 | FSM 状态 |
| --- | --- |
| 标注节点 | `PENDING_ANNOTATION`（新）或 `IN_PROGRESS`（兼容） |
| 审核节点 | `PENDING_REVIEW`（新） |
| 验收节点 | `PENDING_ACCEPTANCE`（新） |
| END 节点 | `COMPLETED` |

### 9.3 转移执行

工作流引擎不直接修改 TaskState，而是调用 FSM 的 `StateManager.execute_transition()`：

```python
# workflows/executor.py
from fsm.state_manager import StateManager

class WorkflowExecutor:
    @classmethod
    def transition_task_state(cls, task, target_fsm_state, user=None):
        transition_name = cls._map_state_to_transition(task, target_fsm_state)
        StateManager.execute_transition(
            entity=task, transition_name=transition_name, user=user
        )
```

### 9.4 未启用工作流时的兼容

当 `feat_workflow=False` 或项目未绑定工作流时：

- 任务沿用现有 FSM 行为（CREATED → IN_PROGRESS → COMPLETED）
- 标注提交时 `annotation_created` 转移自动将 TaskState 设为 COMPLETED
- 工作流 API 返回 404 或空

---

## 10. 迁移与兼容策略

### 10.1 数据库迁移顺序

1. **Step 1**：创建 `workflows` app 的初始迁移（5 个表）
2. **Step 2**：扩展 `fsm/state_choices.py` 的 `TaskStateChoices`（无需迁移，仅枚举）
3. **Step 3**：注册新的 FSM 转移（`task_to_pending_review` 等），无需迁移
4. **Step 4**：预置内置工作流模板（数据迁移，写入 `workflow` 表）

### 10.2 灰度发布策略

1. **阶段 1（默认关闭）**：合并代码，`feat_workflow=False`，所有项目沿用原 FSM
2. **阶段 2（部分项目试点）**：在试点项目开启开关，绑定工作流，验证流转
3. **阶段 3（全量可选）**：所有项目可绑定工作流，但默认不绑定
4. **阶段 4（默认启用）**：新项目默认绑定「简单标注」工作流

### 10.3 兼容性保证

| 场景 | 兼容措施 |
| --- | --- |
| 未绑定工作流的项目 | 标注提交走原 FSM 转移，行为不变 |
| 现有 `TaskState` 数据 | 保留 CREATED/IN_PROGRESS/COMPLETED，不强制迁移到新状态 |
| Enterprise 扩展 | 通过 `settings.WORKFLOW_MIXIN`、`settings.WORKFLOW_NODE_MIXIN` 留扩展点 |
| Data Manager 视图 | 新增「工作流节点」过滤器为可选维度，不影响现有视图 |
| Webhook | 新增 `workflow.node.entered` 事件类型，旧 Webhook 不受影响 |

---

## 11. 测试计划

### 11.1 后端单元测试

| 测试文件 | 覆盖范围 |
| --- | --- |
| `workflows/tests/test_models.py` | 模型字段、约束、级联删除 |
| `workflows/tests/test_api.py` | CRUD API、发布、复制、模板 |
| `workflows/tests/test_engine.py` | 引擎启动、转移、节点进入 |
| `workflows/tests/test_condition_evaluator.py` | 条件表达式沙箱、安全限制 |
| `workflows/tests/test_assignment.py` | 分配策略（轮询、最少负载） |
| `workflows/tests/test_project_binding.py` | 项目绑定、解绑、版本 |
| `workflows/tests/test_monitor.py` | 监控数据聚合 |
| `workflows/tests/test_templates.py` | 内置模板加载与创建 |
| `workflows/tests/test_integration_fsm.py` | 与 FSM 集成、状态映射 |
| `workflows/tests/test_integration_webhook.py` | Webhook 事件触发 |

### 11.2 集成测试场景

1. **端到端：标注-审核-验收**
   - 创建工作流 → 发布 → 绑定项目 → 导入任务 → 标注 → 审核 → 验收 → 完成
2. **驳回循环**
   - 标注 → 审核驳回 → 重新标注 → 审核通过 → 完成
3. **条件路由**
   - 配置条件 `label=="urgent"` → 标注 urgent → 进入高优先级审核
   - 标注 normal → 进入常规审核
4. **并行标注**
   - `overlap=3` → 3 个标注员各提交 → 任务自动完成
5. **主动学习**
   - ML 预标注置信度 0.98 → 直接完成
   - ML 预标注置信度 0.6 → 进入人工修正
6. **工作流复制与升级**
   - 复制 PUBLISHED 工作流为 DRAFT → 修改 → 发布 v2 → 项目升级绑定
7. **未启用工作流的兼容**
   - `feat_workflow=False` → 标注提交走原 FSM → 行为不变
8. **Webhook 触发**
   - 任务进入审核节点 → Webhook 收到 `workflow.node.entered` 事件

### 11.3 前端测试

- 组件单元测试：`WorkflowEditorPage`（React Flow 交互）、节点配置面板
- E2E（Cypress）：从模板创建 → 编辑 → 发布 → 绑定项目 → 标注 → 审核 的全流程

### 11.4 性能测试

- 单项目 10 万任务下，工作流引擎转移单任务耗时 < 100ms
- 监控页查询各节点任务数在 10 万任务规模下 < 1s（验证索引）
- 条件表达式执行在 1000 次/秒下无明显延迟

---

## 12. 里程碑与交付物

### 12.1 里程碑划分

| 里程碑 | 内容 | 交付物 |
| --- | --- | --- |
| M1：数据模型与引擎 | `workflows` app、模型、引擎、条件沙箱 | 后端代码、迁移、单元测试 |
| M2：API 与模板 | CRUD API、6 个内置模板、Webhook 集成 | API 代码、API 测试、模板加载脚本 |
| M3：前端列表与编辑器 | `WorkflowListPage`、`WorkflowEditorPage`（React Flow） | React 组件、单元测试 |
| M4：项目绑定与监控 | `ProjectWorkflowSettings`、`WorkflowMonitorPage` | React 组件、E2E 测试 |
| M5：LSF 集成 | 标注界面工作流操作栏、历史时间线 | LSF 组件、集成测试 |
| M6：灰度上线 | 特性开关、文档、监控 | 部署文档、监控面板 |
| M7：全量发布 | 默认启用、清理开关 | 最终版本 |

### 12.2 交付物清单

1. 后端代码（按 [6.1](#61-新增文件清单)、[6.2](#62-修改的现有文件) 文件清单）
2. 前端代码（按 [7.2](#72-工作流列表页-workflowlistpage) ~ [7.5](#75-项目工作流绑定页-projectworkflowsettings) 结构）
3. 6 个内置工作流模板
4. 数据库迁移文件
5. 单元测试 + 集成测试 + E2E 测试
6. API 文档（Swagger 自动生成）
7. 用户操作手册（管理员视角、标注员视角）
8. 工作流模板最佳实践文档

---

## 13. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Enterprise 版本可能已有工作流能力 | 重复造轮子、合并冲突 | 在 OSS 实现时保留 `MIXIN` 扩展点；与 LSE 团队对齐 |
| 条件表达式沙箱逃逸 | 安全漏洞 | 限制 `__builtins__`；用 `ast` 解析校验；管理员才能配置；审计日志 |
| 工作流引擎性能瓶颈（频繁转移） | API 响应慢 | 批量转移用 `bulk_update`；监控页查询用物化视图/缓存 |
| 复杂工作流难以可视化编辑 | 用户体验差 | 优先支持模板；编辑器限制节点数（如 ≤ 20）；提供文档 |
| 任务在工作流中卡住（无处理人） | 流程停滞 | 超时提醒（Webhook）；监控页高亮；管理员可强制转移 |
| 绑定工作流后现有任务如何处理 | 数据不一致 | 提供选项：仅新任务入流 / 全部入流 / 手动逐个入流 |
| 与 `TaskLock` 冲突（并行标注） | 锁竞争 | 并行标注节点禁用 TaskLock，改用 `overlap` 控制 |
| 工作流版本升级时在途任务如何处理 | 行为不一致 | 在途任务沿用绑定时的版本（`workflow_version`）；新任务用新版本 |
| 删除工作流导致绑定项目异常 | 项目无法运转 | 工作流被绑定时禁止删除（`on_delete=PROTECT`）；只能归档 |
| ML Backend 不可用导致预标注失败 | 流程中断 | ML 节点配置重试次数与超时；失败时回退到人工标注节点 |

---

## 附：参考文件索引

| 主题 | 文件 |
| --- | --- |
| FSM 框架说明 | [fsm/README.md](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/README.md) |
| FSM 状态模型 | [fsm/state_models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_models.py) |
| FSM 状态枚举 | [fsm/state_choices.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_choices.py) |
| FSM 任务转移 | [fsm/task_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/task_transitions.py) |
| FSM 项目转移 | [fsm/project_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/project_transitions.py) |
| FSM 标注转移 | [fsm/annotation_transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/annotation_transitions.py) |
| StateManager | [fsm/state_manager.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/state_manager.py) |
| 注册系统 | [fsm/registry.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/registry.py) |
| Data Manager | [data_manager/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/models.py) |
| Next Task 动作 | [data_manager/actions/next_task.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/actions/next_task.py) |
| Webhook | [webhooks/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/webhooks/models.py) |
| ML Backend | [ml/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/ml) |
| 项目成员 | [projects/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py) |
| 项目整体架构 | [../project/PROJECT.md](../project/PROJECT.md) |
| 账号与权限计划 | [../authorization/AUTHORIZATION.md](../authorization/AUTHORIZATION.md) |
| 现有业务工作流图 | [../project/images/workflow.svg](../project/images/workflow.svg) |
| FSM 状态图 | [../project/images/fsm-state.svg](../project/images/fsm-state.svg) |
