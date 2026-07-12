# Label Studio 依赖分析文档

> 本文档分析 Label Studio 项目对第三方包的依赖关系，重点关注同源（HumanSignal）包的接入方式与浸入程度，并标注依赖的名称、功能、性质（License 等）、使用方式与代码位置。

- **项目版本**：`label-studio 1.24.0.dev0`（参见 [pyproject.toml](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml)）
- **License**：Apache-2.0
- **Python**：>=3.10, <4
- **Node/Yarn**：Yarn workspaces + Nx 单仓库（[web/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json)）

---

## 目录

1. [同源（HumanSignal）依赖](#1-同源humansignal依赖)
2. [Python 核心依赖](#2-python-核心依赖)
3. [Python 测试依赖](#3-python-测试依赖)
4. [前端核心依赖](#4-前端核心依赖)
5. [前端开发依赖](#5-前端开发依赖)
6. [依赖浸入程度总览](#6-依赖浸入程度总览)

---

## 1. 同源（HumanSignal）依赖

Label Studio 由 HumanSignal 维护，其生态中存在若干同源包。本仓库以**直接打包**或**远程 zip 包**的形式接入这些同源包。

### 1.1 `label-studio-sdk`（Python，远程同源包）

| 项目 | 内容 |
| --- | --- |
| 依赖名称 | `label-studio-sdk` |
| 声明位置 | [pyproject.toml#L74-L76](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml#L74-L76) |
| 引用方式 | 直接安装 GitHub 仓库指定 commit 的 zip：`label-studio-sdk @ https://github.com/HumanSignal/label-studio-sdk/archive/54d1aeca71fe7b572c8028e7fe82c4b54457e8f0.zip` |
| 上游仓库 | https://github.com/HumanSignal/label-studio-sdk |
| 功能性质 | HumanSignal 官方 Python SDK，封装：① Label Studio REST API 客户端（`Client`/`LabelStudio`/`AsyncLabelStudio`）；② 标注配置解析与校验（`LabelInterface`、`label_config`）；③ 标注结果转换器（`Converter`，即原 `label-studio-converter`）；④ 内嵌工具扩展 `label_studio_tools`（视频关键帧抽取、XML 配置解析、异常类等）|
| License | Apache-2.0（同主仓库） |
| 浸入程度 | **深度浸入**：直接驱动核心后端业务（标注配置解析、数据导出、预测校验、数据导入、缓存标签、FSM 测试、SDK 集成测试）|

**实际使用位置（按子模块）**：

- 标注配置解析与校验
  - [label_studio/core/label_config.py#L16-L18](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/label_config.py#L16-L18)
    ```python
    from label_studio_sdk._extensions.label_studio_tools.core import label_config
    from label_studio_sdk._legacy.exceptions import LabelStudioValidationErrorSentryIgnored
    from label_studio_sdk.label_interface import LabelInterface
    ```
  - [label_studio/projects/models.py#L42](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/models.py#L42) — `parse_config`
  - [label_studio/projects/serializers.py#L10-L11](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/serializers.py#L10-L11) — `LabelInterface` + `control_tags`
  - [label_studio/tasks/serializers.py#L19](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tasks/serializers.py#L19) — `LabelInterface`
  - [label_studio/tasks/models.py#L42](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tasks/models.py#L42) — `PredictionValue`
  - [label_studio/data_manager/actions/cache_labels.py#L8](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/actions/cache_labels.py#L8) — `LabelInterface`
  - [label_studio/data_import/functions.py#L11](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_import/functions.py#L11)、[label_studio/data_import/api.py#L24](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_import/api.py#L24)

- 数据导出转换器（核心 `Converter`）
  - [label_studio/data_export/models.py#L20](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/models.py#L20) — `from label_studio_sdk.converter import Converter`，[L133](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/models.py#L133)、[L159](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/models.py#L159) 实例化用于导出格式生成
  - [label_studio/data_export/mixins.py#L26](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/mixins.py#L26) — 导出 mixin
  - [label_studio/data_export/serializers.py#L8-L9](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/serializers.py#L8-L9) — `is_video_object_tracking`、`extract_key_frames` 视频后处理

- 异常类型与版本探测
  - [label_studio/core/utils/common.py#L48-L50](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/utils/common.py#L48-L50) — 异常类
  - [label_studio/core/utils/common.py#L481-L483](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/utils/common.py#L481-L483) — `import label_studio_sdk.converter`，版本上报

- SDK 集成测试（驱动整个 SDK 客户端）
  - `label_studio/tests/sdk/`：[test_views.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_views.py)、[test_users.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_users.py)、[test_tasks.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_tasks.py)、[test_storages.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_storages.py)、[test_projects.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_projects.py)、[test_predictions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_predictions.py)、[test_ml.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_ml.py)、[test_export.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_export.py)、[test_annotations.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/sdk/test_annotations.py) 等使用 `from label_studio_sdk.client import LabelStudio` / `from label_studio_sdk import AsyncLabelStudio` 进行端到端 API 测试
  - [label_studio/fsm/tests/helpers.py#L17](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/tests/helpers.py#L17) — FSM 工作流测试中实例化 `LabelStudio` 客户端

### 1.2 `@humansignal/audio-file-decoder`（前端，npm 同源包）

| 项目 | 内容 |
| --- | --- |
| 依赖名称 | `@humansignal/audio-file-decoder` |
| 版本 | `0.1.5` |
| 声明位置 | [web/package.json#L49](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json#L49)、[web/libs/editor/package.json#L9](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor/package.json#L9) |
| 功能性质 | HumanSignal 发布的音频文件解码器（基于 WebAssembly/WASM 的 ffmpeg 解码 + Web Worker），用于在浏览器端解码音频并生成波形数据 |
| License | 推断为 FOSS（npm 包，配合主仓库 Apache-2.0） |
| 浸入程度 | **中度浸入**：仅在 LSF 编辑器的 AudioUltra 音频标注场景中使用 |

**使用位置**：

- [web/libs/editor/src/lib/AudioUltra/Media/AudioDecoder.ts#L1-L4](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor/src/lib/AudioUltra/Media/AudioDecoder.ts#L1-L4)
  ```typescript
  import { type AudioDecoderWorker, getAudioDecoderWorker } from "@humansignal/audio-file-decoder";
  import DecodeAudioWasm from "@humansignal/audio-file-decoder/decode-audio.wasm";
  ```
  该类继承 `BaseAudioDecoder`，通过 Web Worker 分块解码音频（每块 30 分钟），支持多声道拆分和取消解码，是音频波形显示与标注的核心。

### 1.3 前端 Monorepo 内部 `@humansignal/*` 包

这些包**同仓库同源**，通过 Yarn workspaces 在 `web/libs/` 下作为本地包互相引用，不通过 npm 远程安装。

| 包名 | 路径 | 角色 | License |
| --- | --- | --- | --- |
| `@humansignal/source` | [web/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json) | Monorepo 根包 | MIT |
| `@humansignal/editor` | [web/libs/editor](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor) | Label Studio Frontend (LSF) — 可嵌入的标注 UI 库，React + mobx-state-tree | MIT |
| `@humansignal/datamanager` | [web/libs/datamanager](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/datamanager) | 数据管理库（任务列表、过滤、视图） | MIT |
| `@humansignal/ui` | [web/libs/ui](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/ui) | 设计系统组件库（基于 Radix UI + Tailwind，含 Button、Modal、Select、Tooltip、Dropdown 等） | MIT |
| `@humansignal/core` | [web/libs/core](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/core) | 共享核心工具（API provider、hooks、bem、user atom 等） | MIT |
| `@humansignal/app-common` | [web/libs/app-common](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/app-common) | 跨 app 的应用层共享组件（StorageProviderForm、AccountSettings、state-chips 等） | MIT |
| `@humansignal/frontend-test` | [web/libs/frontend-test](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/frontend-test) | 前端测试辅助库（`LabelStudio` 测试 fixture） | MIT |

**浸入程度与引用规模**：

- `@humansignal/core` —— 被 100+ 文件引用（137 处出现），是前端工具与原子状态的根基
- `@humansignal/ui` —— 被 100+ 文件引用（129 处出现），承担设计系统组件供应
- `@humansignal/app-common` —— 被 20+ 文件引用（23 处出现），主要在 `apps/labelstudio` 与 `libs/datamanager` 中复用应用层组件
- `@humansignal/editor` —— LSF 是标注核心，被 `apps/labelstudio`、`apps/playground` 作为标注 UI 集成
- `@humansignal/datamanager` —— 数据管理 UI，被 `apps/labelstudio` 集成

**导入规则**（参见 [AGENTS.md](file:///c:/Users/yystj/work/label-studio/label-studio/AGENTS.md)）：
- `web/apps` 可从 `web/libs` 导入；
- `web/libs` 不可从 `web/apps` 导入；
- `web/libs/app-common` 可从其他 `web/libs` 或 `web/apps` 导入，但其他 `web/libs` 不可从 `app-common` 导入。

### 1.4 同源生态的其他仓库（间接依赖，不直接安装）

以下仓库在主项目中被文档/CI 引用，但不直接作为依赖安装（仅作为外部交互对象）：

- [label-studio-ml-backend](https://github.com/HumanSignal/label-studio-ml-backend)：通过 `label_studio/ml/` 模块以 HTTP 调用方式交互（[label_studio/ml/README.md](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/ml/README.md)）
- `label-studio-frontend`：本仓库 `web/libs/editor` 即为该库的当前形态（已合入主仓库作为 monorepo 一员），同时打包发布至 npm 给第三方嵌入使用

---

## 2. Python 核心依赖

声明位置：[pyproject.toml `dependencies`](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml#L16-L77)

### 2.1 Web 框架与 ORM

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `Django` | `>=5.1.8,<5.2.0` | 主 Web 框架，提供 ORM、MTV、认证、admin、信号 | BSD-3-Clause | 全栈基础设施；`DJANGO_SETTINGS_MODULE=core.settings.label_studio` |
| `djangorestframework` | `==3.15.2` | REST API 框架（DRF） | BSD-2-Clause | 所有 API 视图与序列化器 |
| `drf-spectacular` | `==0.28.0` | OpenAPI schema 生成（drf-spectacular） | BSD-3-Clause | 35+ 文件，例如 [label_studio/projects/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/projects/api.py)、[label_studio/tasks/api.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tasks/api.py)；schema 输出 `/docs/api/schema/` |
| `drf-flex-fields` | `==0.9.5` | DRF 动态字段展开（如 `?fields=...`） | MIT | [label_studio/data_export/serializers.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_export/serializers.py) |
| `drf-dynamic-fields` | `==0.3.0` | DRF 动态字段（旧版用法） | MIT | 序列化器混入 |
| `drf-generators` | `==0.3.0` | DRF 脚手架生成器 | MIT | 开发辅助 |
| `django-filter` | `==24.3` | DRF 过滤后端 | BSD-3-Clause | 列表过滤 |
| `django-cors-headers` | `==4.7.0` | CORS 中间件 | MIT | 跨域 |
| `django-rq` | `>=3.1,<3.2` | Django + RQ 集成（队列管理） | BSD-2-Clause | [label_studio/io_storages/base_models.py#L17](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/base_models.py#L17)、[label_studio/core/redis.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/redis.py) |
| `django-environ` | `==0.10.0` | 环境变量读取（`.env`） | MIT | [label_studio/core/settings/base.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/settings/base.py) |
| `django-extensions` | `==3.2.3` | `shell_plus`、`runserver_plus` 等开发命令 | MIT | Makefile `make shell-dev` |
| `django-annoying` | `==0.10.6` | DRF/Django 便捷装饰器 | BSD-3-Clause | 视图装饰 |
| `django-storages` | `==1.12.3` | 云存储后端抽象（S3/GCS/Azure） | BSD-3-Clause | [label_studio/io_storages/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages) |
| `django-debug-toolbar` | `==3.2.1` | 调试工具栏 | BSD-3-Clause | 开发模式 |
| `django-user-agents` | `==0.4.0` | UA 解析中间件 | MIT | 用户代理识别 |
| `django-ranged-fileresponse` | `>=0.1.2` | 支持 Range 请求的文件响应 | MIT | [label_studio/data_import/api.py#L26](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_import/api.py#L26)（`RangedFileResponse` 用于音视频流） |
| `django-csp` | `==3.7` | Content Security Policy 中间件 | BSD-2-Clause | 安全头 |
| `django-migration-linter` | `>=5.1.0,<6.0.0` | 迁移 SQL 检查 | Apache-2.0 | CI |
| `djangorestframework-simplejwt[crypto]` | `>=5.4.0,<6.0.0` | JWT 认证 | MIT | [label_studio/jwt_auth/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/jwt_auth)（views/models/serializers/middleware） |

### 2.2 数据库与缓存

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `psycopg[binary]` | `>=3.2.0,<4.0.0` | PostgreSQL 适配器（psycopg3） | LGPL-3.0 | 生产数据库驱动 |
| `redis` | `>=5.2.1,<5.3.0` | Redis 客户端 | MIT | [label_studio/core/redis.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/redis.py)、[label_studio/io_storages/redis/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/redis/models.py) |
| `rq` | `>=2.6,<2.7` | Redis Queue 任务队列 | BSD-2-Clause | [label_studio/core/redis.py#L14-L16](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/redis.py#L14-L16)、[label_studio/io_storages/base_models.py#L18-L19,L35](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/base_models.py#L18-L19) |

### 2.3 数据处理与科学计算

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `numpy` | `>=2.2.6,<3.0.0` | 数值计算 | BSD-3-Clause | [label_studio/data_import/models.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_import/models.py)、[label_studio/core/label_config.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/label_config.py) |
| `pandas` | `>=2.2.3` | 表格数据处理（导出 CSV/Excel） | BSD-3-Clause | 数据导出/导入 |
| `pyarrow` | `>=23.0.1,<24.0.0` | Arrow/Parquet 文件读写 | Apache-2.0 | 导出 Parquet 格式 |
| `ujson` | `>=5.13.0` | 高性能 JSON 解析 | BSD-3-Clause | 序列化 |
| `ijson` | `>=3.4.0,<4.0.0` | 流式 JSON 解析 | BSD-3-Clause | 大文件导入 |
| `xmljson` | `==0.2.1` | XML↔JSON 转换 | MIT | [label_studio/core/label_config.py#L14](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/label_config.py#L14) |
| `python-dateutil` | `>=2.8.1` | 日期解析 | BSD-3-Clause | 通用 |
| `pytz` | `>=2022.1,<2023.0` | 时区 | MIT | 通用 |
| `ordered-set` | `==4.0.2` | 有序集合 | MPL-2.0 | 数据处理 |

### 2.4 XML 与安全

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `lxml[html-clean]` | `>=6.1.0` | XML/HTML 解析 + 清洗 | BSD-3-Clause | 标注配置 XML 解析 |
| `defusedxml` | `>=0.7.1` | 安全 XML 解析（防 XXE） | Python-2.0 | 用户上传 XML 校验 |
| `bleach` | `>=6.4.0,<6.5.0` | HTML 白名单清洗 | Apache-2.0 | 防 XSS |
| `cryptography` | `>=48.0.1` | 加密原语 | Apache-2.0/BSD-3-Clause | JWT/密钥 |

### 2.5 云存储 SDK

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `boto3` | `>=1.28.58,<2.0.0` | AWS SDK（S3 等） | Apache-2.0 | [label_studio/io_storages/s3/models.py#L9](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/s3/models.py#L9)、[label_studio/io_storages/s3/utils.py#L10-L40](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/s3/utils.py#L10-L40)（`boto3.Session`、`session.client('s3', ...)`） |
| `botocore` | `>=1.39.3,<2.0.0` | boto3 底层（异常类等） | Apache-2.0 | [label_studio/io_storages/s3/utils.py#L11](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/s3/utils.py#L11)（`ClientError`） |
| `azure-storage-blob` | `>=12.6.0` | Azure Blob 存储 | MIT | [label_studio/io_storages/azure_blob/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/azure_blob) |
| `google-cloud-storage` | `>=3.8.0,<4.0.0` | GCS 客户端 | Apache-2.0 | [label_studio/io_storages/gcs/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/io_storages/gcs) |
| `google-cloud-logging` | `>=3.10.0,<4.0.0` | GCP 日志 | Apache-2.0 | 日志集成 |

### 2.6 特性开关与可观测性

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `launchdarkly-server-sdk` | `==8.2.1` | LaunchDarkly 特性开关 SDK | Apache-2.0 | [label_studio/core/feature_flags/base.py#L3-L8](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/feature_flags/base.py#L3-L8)（`import ldclient`、`Files`、`Redis` 集成）；OSS 中以 `offline=True` 模式运行，`flag_set("feat_name")` 守护新行为 |
| `sentry-sdk` | `>=2.16.0` | Sentry 错误监控 | MIT | [label_studio/core/utils/sentry.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/utils/sentry.py)、[label_studio/core/utils/common.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/utils/common.py) |
| `python-json-logger` | `==2.0.4` | 结构化 JSON 日志 | BSD-2-Clause | 日志格式化 |

### 2.7 AI 与 ML 集成

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `openai` | `>=1.10.0,<2.0.0` | OpenAI 客户端（用于 LLM 辅助标注/预标注） | Apache-2.0 | 在 `ml/` 与 `ml_models/` 中按需调用（项目已引入，未在 `label_studio/` 顶层直接 import） |

### 2.8 工具与基础设施

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `pyyaml` | `>=6.0.0` | YAML 解析 | MIT | 配置/模板 |
| `pydantic` | `>=2.9.2` | 数据校验与模型 | MIT | [label_studio/fsm/transitions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm/transitions.py)、[label_studio/data_manager/managers.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/data_manager/managers.py)、[label_studio/core/permissions.py](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/core/permissions.py) 等 12 处 |
| `attrs` | `>=19.2.0` / `attr==0.3.1` | 类属性建模 | MIT | 通用 |
| `requests` | `>=2.33.0,<2.34.0` | HTTP 客户端 | Apache-2.0 | ML 后端/webhook 调用 |
| `rules` | `==3.4` | 规则引擎 | MIT | 权限规则 |
| `colorama` | `>=0.4.4` | 终端颜色 | BSD-3-Clause | CLI |
| `pyboxen` | `>=1.3.0` | 终端 boxed 输出 | MIT | CLI |
| `appdirs` | `>=1.4.3` | 跨平台路径 | MIT | 数据目录 |
| `tldextract` | `>=5.1.3` | 域名解析 | BSD-3-Clause | URL 处理 |
| `uuid-utils` | `>=0.11.0,<1.0.0` | UUID7 等高级 UUID | MIT | [label_studio/fsm/](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/fsm) UUID7 优化状态记录 |
| `setuptools` | `>=75.4.0` | 打包 | MIT | 构建 |
| `wheel` | `>=0.46.3` | wheel 构建 | MIT | 打包 |

### 2.9 可选依赖

| 依赖 | 版本 | 功能 | License | 使用方式与位置 |
| --- | --- | --- | --- | --- |
| `pyuwsgi` | `==2.0.28.post1` | uWSGI 服务器 | GPL-2.0-linking-exception | 生产部署（`[project.optional-dependencies] uwsgi`） |
| `uwsgitop` | `==0.12` | uWSGI 监控 | BSD-2-Clause | 生产部署监控 |

---

## 3. Python 测试依赖

声明位置：[pyproject.toml `[tool.poetry.group.test.dependencies]`](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml#L184-L202)

| 依赖 | 版本 | 功能 | License | 使用方式 |
| --- | --- | --- | --- | --- |
| `pytest` | `7.2.2` | 测试框架 | MIT | `pytest -vv`，由 `make test` 驱动 |
| `pytest-django` | `4.9.0` | Django 集成 | BSD-3-Clause | DB fixture |
| `pytest-mock` | `3.14.0` | mocker fixture | MIT | mock |
| `pytest-cov` | `5.0.0` | 覆盖率 | MIT | 覆盖率 |
| `pytest-env` | `0.6.2` | 环境变量注入 | MIT | 测试环境 |
| `pytest-xdist` | `3.6.1` | 并行测试 | MIT | 并行 |
| `tavern` | `2.3` | API 端到端测试（YAML） | MIT | 优先用于 API 端点测试 |
| `fakeredis` | `~=2.26.1` | Redis mock | BSD-3-Clause | 无 Redis 环境 |
| `responses` | `0.13.0` | requests mock | Apache-2.0 | HTTP mock |
| `requests-mock` | `1.12.1` | requests mock（另一选择） | Apache-2.0 | HTTP mock |
| `mock` | `>=5.1.0` | mock 库 | BSD-3-Clause | 通用 mock |
| `moto` | `>=4.2.6` | AWS 服务 mock | Apache-2.0 | S3 测试 |
| `s3transfer` | `0.13.0` | S3 传输 | Apache-2.0 | AWS 测试 |
| `factory-boy` | `^3.3.3` | 测试数据工厂 | MIT | 数据生成 |
| `freezegun` | `~=1.5.1` | 时间冻结 | MIT | 时间相关测试 |
| `psutil` | `7.0.0` | 系统信息 | BSD-3-Clause | 测试 |
| `pre-commit` | `3.3.3` | 钩子管理 | MIT | `make fmt` |

构建依赖（[L203-L205](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml#L203-L205)）：

- `twine >=6.1.0`（PyPI 上传，Apache-2.0）
- `packaging >=24.2`（版本解析，Apache-2.0/BSD-3-Clause）

负载测试：[label_studio/tests/loadtests/requirements.txt](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/loadtests/requirements.txt) 仅 `locust==1.3.2`（MIT）。

---

## 4. 前端核心依赖

声明位置：[web/package.json `dependencies`](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json#L46-L119)（同时聚合各 `libs/*/package.json`）

### 4.1 框架与状态管理

| 依赖 | 版本 | 功能 | License | 使用方式 |
| --- | --- | --- | --- | --- |
| `react` | `18.3.1` | UI 框架 | MIT | 全栈基础 |
| `react-dom` | `18.3.1` | DOM 渲染 | MIT | 全栈基础 |
| `react-router` / `react-router-dom` | `^5.2.0` | 路由 | MIT | `apps/labelstudio` 路由 |
| `mobx` | `^5.15.4` | 响应式状态 | MIT | LSF 与 DM 核心 |
| `mobx-react` | `^6` | MobX React 绑定 | MIT | 观察者组件 |
| `mobx-react-lite` | `2.2.2` | MobX 轻量绑定 | MIT | LSF/DM 内 |
| `mobx-state-tree` | `^3.16.0` | MST 状态树（LSF 模型核心） | MIT | [web/libs/editor/src/components/Node/Node.tsx](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor/src/components/Node/Node.tsx)、[web/libs/datamanager/src/stores/AppStore.js](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/datamanager/src/stores/AppStore.js) |
| `jotai` | `^2.11.3` | 原子化状态（主 app） | MIT | 主 app 全局状态（[AGENTS.md](file:///c:/Users/yystj/work/label-studio/label-studio/AGENTS.md) 规定 Jotai 为全局状态首选） |
| `jotai-tanstack-query` | `^0.9.0` | Jotai + React Query 集成 | MIT | `atomWithQuery` |
| `@tanstack/react-query` | `^4` | 服务端状态/缓存 | MIT | API 数据缓存 |
| `@tanstack/react-table` | `^8.21.3` | 表格库 | MIT | 数据表 |
| `@tanstack/query-core` | `^5.66.0` | React Query 核心 | MIT | — |
| `history` | `^4.10.1` | 路由历史 | MIT | — |
| `zod` | `^3.23.8` | TS schema 校验 | MIT | 类型校验 |

### 4.2 UI 组件与样式

| 依赖 | 版本 | 功能 | License | 使用方式 |
| --- | --- | --- | --- | --- |
| `antd` | `^4.3.3` | Ant Design 4 组件库 | MIT | 旧版组件（LSF/DM 与主 app 部分页面） |
| `@ant-design/icons` | `4.8.1` | Ant Design 图标 | MIT | 图标 |
| `@ant-design/colors` | `6.0.0` | Ant Design 颜色 | MIT | 颜色 |
| `@radix-ui/react-*` | 多 | 无头 UI 原语（dialog/popover/switch/tabs/accordion/slot/toast） | MIT | 设计系统 `@humansignal/ui` 与 shadcn 风格组件 |
| `shadcn` | `^2.1.8` | shadcn CLI/组件生成 | MIT | UI 组件体系 |
| `class-variance-authority` | `^0.7.1` | 类名变体 | Apache-2.0 | 组件变体 |
| `clsx` | `^2.1.1` | 类名拼接 | MIT | 通用 |
| `tailwind-merge` | `^2.6.0` | Tailwind 类合并 | MIT | 样式 |
| `chroma-js` | `^2.1.1` | 颜色操作 | BSD-3-Clause | 标注颜色生成 |
| `colormap` | `^2.3.2` | 色彩映射 | MIT | 数据可视化 |
| `sanitize-html` | `^2.14.0` | HTML 清洗 | MIT | 富文本渲染 |
| `html-react-parser` | `^1.2.4` | HTML→React | MIT | — |

### 4.3 标注与可视化

| 依赖 | 版本 | 功能 | License | 使用方式 |
| --- | --- | --- | --- | --- |
| `konva` | `^8.1.3` | 2D Canvas 库 | MIT | LSF 图像/视频区域绘制 |
| `react-konva` | `^18.2.10` | React Konva 绑定 | MIT | — |
| `react-konva-utils` | `^0.2.0` | Konva 工具 | MIT | — |
| `d3` | `^5.16.0` | 数据可视化 | BSD-3-Clause | 图表 |
| `d3-color` | `3.1.0` | D3 颜色 | BSD-3-Clause | 颜色（resolutions 锁定 3.1.0） |
| `@thi.ng/rle-pack` | `^3.1.30` | RLE 压缩 | Apache-2.0 | 音频/图像数据 |
| `fft.js` | `^4.0.4` | FFT | MIT | 音频频谱 |
| `webfft` | `^1.0.3` | WebAssembly FFT | MIT | 音频频谱 |
| `@humansignal/audio-file-decoder` | `0.1.5` | 同源音频解码 | 见 §1.2 | [AudioDecoder.ts](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor/src/lib/AudioUltra/Media/AudioDecoder.ts) |
| `papaparse` | `^5.4.1` | CSV 解析 | MIT | 导入 CSV |
| `pako` | `^2.1.0` | zlib 压缩 | MIT-OLD | 数据压缩 |
| `simplify-js` | `^1.2.4` | 折线简化 | MIT | 区域路径简化 |
| `xpath-range` | `^1.1.1` | XPath 范围 | MIT | 文本标注 |

### 4.4 交互与体验

| 依赖 | 版本 | 功能 | License | 使用方式 |
| --- | --- | --- | --- | --- |
| `react-beautiful-dnd` | `^13.1.1` | 拖拽列表 | Apache-2.0 | 列表拖拽 |
| `react-hotkeys-hook` | `^2.4.0` | 快捷键 | MIT | 标注快捷键 |
| `react-virtualized-auto-sizer` | `^1.0.20` | 虚拟列表尺寸 | MIT | 虚拟化 |
| `react-window` | `^1.8.11` | 虚拟列表 | MIT | 任务列表 |
| `react-window-infinite-loader` | `^1.0.5` | 无限加载 | MIT | 任务滚动 |
| `react-datepicker` | `^3.6.0` | 日期选择 | MIT | — |
| `react-joyride` | `^2.9.3` | 引导教程 | MIT | 用户引导 |
| `react-markdown` | `^10.1.0` | Markdown 渲染 | MIT | — |
| `rehype-raw` | `^7.0.0` | rehype 原始 HTML | MIT | — |
| `react-codemirror2` | `^7.2.1` | CodeMirror React | MIT | XML 配置编辑器 |
| `codemirror` | `^5.59.4` | 代码编辑器 | MIT | — |
| `cmdk` | `^1.1.1` | 命令面板 | Apache-2.0 | — |
| `rc-tree` | `^5.7.8` | 树控件 | MIT | — |
| `json-edit-react` | `^1.29.0` | JSON 编辑器 | MIT | — |
| `jsonpath-plus` | `^10.3.0` | JSONPath | MIT | — |
| `keymaster` | `^1.6.2` | 快捷键（底层） | MIT | — |
| `pleasejs` | `^0.4.2` | 随机颜色生成 | MIT | — |
| `emoji-regex` | `^7.0.3` | emoji 正则 | MIT | — |
| `insert-after` | `^0.1.4` | DOM 插入 | MIT | — |
| `js-base64` | `^3.7.7` | base64 | BSD-3-Clause | — |
| `nanoid` | `^3.3.8` | ID 生成 | MIT | 区域 ID |
| `deep-equal` | `^2.0.5` | 深比较 | MIT | — |
| `date-fns` | `^2.20.1` | 日期工具 | MIT | — |
| `sucrase` | `^3.35.0` | TS/Babel 超快编译 | MIT | — |
| `es-toolkit` | `^1.44.0` | lodash 替代 | MIT | [AGENTS.md](file:///c:/Users/yystj/work/label-studio/label-studio/AGENTS.md) 强制禁止 lodash，使用 `@humansignal/core` 再导出的 `es-toolkit` |
| `react-singleton-hook` | `^3.1.1` | 单例 hook | MIT | — |
| `react-markdown` | `^10.1.0` | Markdown | MIT | — |

### 4.5 其他

| 依赖 | 版本 | 功能 | License |
| --- | --- | --- | --- |
| `prop-types` | `15.8.1` | React props 类型 | MIT |
| `mobx-react-lite` | `2.2.2` | MobX Lite | MIT |
| `storybook` | `^9.1.19` | 组件文档 | MIT |

---

## 5. 前端开发依赖

声明位置：[web/package.json `devDependencies`](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json#L120-L229)

### 5.1 构建与打包

| 依赖 | 版本 | 功能 | License |
| --- | --- | --- | --- |
| `webpack` | `5.104.1` | 模块打包 | MIT |
| `webpack-cli` | `^5.0.1` | CLI | MIT |
| `webpack-merge` | `^5.9.0` | 配置合并 | MIT |
| `nx` | `21.4.0` | Monorepo 任务编排 | MIT |
| `@nx/*` | `21.4.0` | Nx 插件（react/webpack/jest/cypress/storybook/js/workspace） | MIT |
| `swc` | `1.5.7`/`0.6.0` | SWC 编译器 | Apache-2.0 |
| `babel-*` | 多 | Babel 编译链 | MIT |
| `ts-loader` | `^9.4.2` | TS loader | MIT |
| `typescript` | `5.8.3` | TS 编译器 | Apache-2.0 |
| `ts-node` | `10.9.1` | Node TS 执行 | MIT |
| `tslib` | `^2.3.0` | TS runtime helpers | Apache-2.0 |
| `@svgr/webpack` | `^8.1.0` | SVG→React | MIT |
| `postcss` / `autoprefixer` / `postcss-*` | 多 | CSS 处理 | MIT |
| `tailwindcss` | `3.4.3` | 原子化 CSS | MIT |
| `tailwindcss-animate` | `^1.0.7` | Tailwind 动画 | MIT |
| `tailwind-scrollbar` | `3` | Tailwind 滚动条 | MIT |
| `mini-css-extract-plugin` | `^2.7.6` | CSS 提取 | MIT |
| `css-loader` / `style-loader` | 多 | CSS loader | MIT |
| `css-minimizer-webpack-plugin` | `^3.0.2` | CSS 压缩 | MIT |
| `source-map-loader` | `^5.0.0` | sourcemap | MIT |
| `loader-utils` | `^3.2.1` | loader 工具 | MIT |
| `dotenv-defaults` | `^2.0.2` | env 默认值 | MIT |
| `proper-lockfile` | `^4.1.2` | 文件锁 | MIT |
| `@module-federation/dts-plugin` | `0.18.0` | Module Federation 类型 | MIT |

### 5.2 测试

| 依赖 | 版本 | 功能 | License |
| --- | --- | --- | --- |
| `jest` | `30.0.5` | 单元测试框架 | MIT |
| `jest-environment-jsdom` | `^29.7.0` | jsdom 环境 | MIT |
| `babel-jest` | `30.0.5` | Babel Jest | MIT |
| `ts-jest` | `29.4.5` | TS Jest | MIT |
| `@testing-library/react` | `16.3.0` | RTL | MIT |
| `@testing-library/dom` | `10.4.0` | DOM 测试 | MIT |
| `cypress` | `14.5.0` | E2E 框架 | MIT |
| `@cypress/*` | 多 | Cypress 插件（code-coverage/webpack-preprocessor） | MIT |
| `cypress-image-snapshot` | `^4.0.1` | 视觉回归 | Apache-2.0 |
| `cypress-multi-reporters` | `^2.0.5` | 多报告器 | MIT |
| `cypress-parallel` | `^0.15.0` | 并行 | MIT |
| `cypress-terminal-report` | `^5.1.1` | 终端报告 | MIT |
| `sinon` | `^17.0.1` | 测试桩 | BSD-3-Clause |
| `chai` | `^4.3.7` | 断言 | MIT |
| `jsdom` | `~22.1.0` | DOM 模拟 | MIT |
| `jest-fetch-mock` | `^3.0.3` | fetch mock | MIT |
| `pixelmatch` | `7.1.0` | 像素对比 | ISC |
| `pngjs` | `^7.0.0` | PNG 解析 | MIT |

### 5.3 代码质量与文档

| 依赖 | 版本 | 功能 | License |
| --- | --- | --- | --- |
| `@biomejs/biome` | `^2.4.6` | JS/CSS linter/formatter | MIT/Apache-2.0 |
| `typescript-plugin-css-modules` | `^5.2.0` | CSS Module 类型 | MIT |
| `jsdoc-to-markdown` | `8.0.1` | JSDoc→MD | MIT |
| `react-refresh` / `@pmmmwh/react-refresh-webpack-plugin` | 多 | HMR | MIT |
| `@sentry/browser` / `@sentry/react` | `^8.33` | 前端错误监控 | MIT |
| `@storybook/*` | 多 | 组件文档 | MIT |
| `yargs` | `^17.7.1` | CLI 参数 | MIT |
| `toml` | `^3.0.0` | TOML 解析 | MIT |
| `truncate-middle` | `^1.0.6` | 字符串截断 | MIT |
| `shallow-equal` | `^1.2.1` | 浅比较 | MIT |
| `@types/*` | 多 | 类型定义 | — |
| `koa` | `3.1.2` | Koa 服务（playground） | MIT |

### 5.4 Resolutions（安全/兼容性强制覆盖）

[web/package.json `resolutions`](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json#L230-L269) 强制锁定大量传递依赖的版本，主要目的：
- **安全漏洞修复**：`axios >=1.13.5`、`lodash >=4.18.1`、`ws 8.17.1`、`moment 2.29.4`、`js-yaml 4.1.1`、`debug >=4.3.1`、`form-data 4.0.4`、`serialize-javascript >=7.0.3`、`minimatch >=10.2.3`、`svgo >=3.3.3`、`ajv >=8.18.0`、`esbuild >=0.25.5`、`rollup >=4.59.0`、`diff >=8.0.3`
- **兼容性锁定**：`webpack 5.104.1`、`d3-color 3.1.0`、`@radix-ui/react-slot 1.2.3`、`@module-federation/dts-plugin >=0.18.0`
- **空包替换（禁用）**：`sass`、`sass-loader`、`sass-embedded`、`stylus`、`less`、`less-loader`、`stylelint`、`stylelint-config-*` 全部替换为 `empty-npm-package@1.0.0`，表明项目仅使用 Tailwind + CSS Modules，禁用其他样式预处理器与 stylelint

---

## 6. 依赖浸入程度总览

| 浸入等级 | 含义 | 代表依赖 |
| --- | --- | --- |
| **深度浸入** | 直接驱动核心业务流程，移除将导致核心功能不可用 | `label-studio-sdk`（标注配置/导出/校验）、`Django`/`djangorestframework`、`django-rq`+`rq`+`redis`（异步任务）、`boto3`（S3 存储）、`launchdarkly-server-sdk`（特性开关）、`mobx-state-tree`（LSF/DM 状态）、`@humansignal/ui`/`@humansignal/core`（设计系统与工具）、`@humansignal/editor`（标注 UI） |
| **中度浸入** | 关键模块使用但范围有限 | `pydantic`（FSM/data_manager 校验）、`sentry-sdk`（错误监控）、`drf-spectacular`（OpenAPI schema）、`@humansignal/audio-file-decoder`（音频解码）、`@humansignal/app-common`（应用层共享组件）、`azure-storage-blob`/`google-cloud-storage`（云存储） |
| **轻度浸入** | 通用工具或特定场景 | `numpy`/`pandas`/`pyarrow`、`openai`、`tldextract`、`uuid-utils`、各种前端图表/工具库 |

### 同源包接入方式总结

| 同源包 | 接入方式 | 版本控制策略 |
| --- | --- | --- |
| `label-studio-sdk` | 远程 GitHub zip 指定 commit（`54d1aeca71fe7b572c8028e7fe82c4b54457e8f0`） | 锁定到具体 commit，升级需修改 [pyproject.toml#L75](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml#L75) URL |
| `@humansignal/audio-file-decoder` | npm 包（`0.1.5`） | 标准语义化版本 |
| `@humansignal/editor`/`datamanager`/`ui`/`core`/`app-common`/`frontend-test` | Monorepo 本地 Yarn workspace（`0.0.0`，无外部版本） | 与主仓库同步演进，无独立版本号 |

### 关键配置文件位置

| 文件 | 用途 |
| --- | --- |
| [pyproject.toml](file:///c:/Users/yystj/work/label-studio/label-studio/pyproject.toml) | Python 运行时依赖、测试依赖、构建依赖、Ruff 配置、Poetry 配置 |
| [web/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/package.json) | 前端运行时依赖、开发依赖、resolutions |
| [web/libs/editor/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/editor/package.json) | LSF 子包依赖（含 `@humansignal/audio-file-decoder`） |
| [web/libs/datamanager/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/datamanager/package.json) | DM 子包依赖 |
| [web/libs/ui/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/ui/package.json) | UI 子包依赖 |
| [web/libs/core/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/core/package.json) | core 子包依赖 |
| [web/libs/app-common/package.json](file:///c:/Users/yystj/work/label-studio/label-studio/web/libs/app-common/package.json) | app-common 子包依赖 |
| [label_studio/tests/loadtests/requirements.txt](file:///c:/Users/yystj/work/label-studio/label-studio/label_studio/tests/loadtests/requirements.txt) | 负载测试依赖（locust） |
| [.github/helpers/gh_changelog_generator/requirements.txt](file:///c:/Users/yystj/work/label-studio/label-studio/.github/helpers/gh_changelog_generator/requirements.txt) | 变更日志生成器依赖 |
| [web/yarn.lock](file:///c:/Users/yystj/work/label-studio/label-studio/web/yarn.lock) | 前端锁定文件 |

---

## 附：与同源生态的交互关系

```
┌─────────────────────────────────────────────────────────────┐
│  本仓库 label-studio (HumanSignal/label-studio)            │
│  ┌──────────────────────┐    ┌───────────────────────────┐ │
│  │ Python 后端           │    │ 前端 Monorepo             │ │
│  │ (label_studio/)       │    │ (web/)                    │ │
│  │                       │    │                           │ │
│  │ ┌─────────────────┐   │    │ ┌─────────────────────┐   │ │
│  │ │ label_studio_sdk│◄─┼────┼─│ (远程 zip 安装)      │   │ │
│  │ │ (远程同源包)     │   │    │ └─────────────────────┘   │ │
│  │ └─────────────────┘   │    │ ┌─────────────────────┐   │ │
│  │   ↑ Python import     │    │ │ @humansignal/editor│   │ │
│  │   │ LabelInterface    │    │ │ @humansignal/datamanager│ │
│  │   │ Converter          │    │ │ @humansignal/ui    │   │ │
│  │   │ label_config      │    │ │ @humansignal/core  │   │ │
│  │   │ exceptions         │    │ │ @humansignal/app-common│ │
│  │                       │    │ │ @humansignal/frontend-test│ │
│  │ ML 后端交互 (HTTP)    │    │ │ @humansignal/audio-file-decoder (npm) │ │
│  │ ┌─────────────────┐   │    │ └─────────────────────┘   │ │
│  │ │label-studio-    │   │    │   ↑ 内部 workspace 引用    │ │
│  │ │ml-backend(外部) │───┼────┼───────────────────────────┼ │
│  │ └─────────────────┘   │    │                           │ │
│  └──────────────────────┘    └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                  ▲
                  │ HTTP (REST API)
                  │
        ┌─────────────────────┐
        │ label-studio-sdk    │
        │ (用户/CI 调用)       │
        └─────────────────────┘
```

> 说明：`label-studio-sdk` 既被本仓库 Python 后端**直接 import**使用其内部能力（配置解析、转换器、异常类），又作为外部 SDK 供用户与 CI 通过 REST API 调用本仓库服务，是同源生态中**双向流通**最深的依赖。
