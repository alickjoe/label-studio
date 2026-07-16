# label-studio-sdk 引用分析

本文档列出了 label-studio 项目中对 label-studio-sdk 代码的所有引用，包括引用位置、被引用的 SDK 代码位置以及功能描述。

> **注意**：由于当前环境中未安装 label-studio-sdk 包，文档中列出的 SDK 源文件路径（如 `label_studio_sdk/label_interface/__init__.py`）是基于 Python 导入约定推断的，而非从实际安装的包中验证。这些路径遵循标准的 Python 包结构约定，具有较高的准确性。

## 一、核心业务代码中的引用

### 1. label_config.py - 标签配置解析

**引用位置**: [label_studio/core/label_config.py](file:///home/quan/work/labeling/label-studio/label_studio/core/label_config.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk._extensions.label_studio_tools.core import label_config` | `label_studio_sdk/_extensions/label_studio_tools/core/label_config.py` | 导入标签配置解析模块，用于解析 Label Studio XML 配置 |
| `from label_studio_sdk._legacy.exceptions import LabelStudioValidationErrorSentryIgnored` | `label_studio_sdk/_legacy/exceptions.py` | 导入验证异常类，用于捕获配置验证错误 |
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类，用于验证标签配置和标签属性 |

**使用示例**:
```python
def parse_config(config_string):
    logger.warning('Using deprecated method - switch to label_studio.tools.label_config.parse_config!')
    return label_config.parse_config(config_string)

li = LabelInterface(config_string)
if hasattr(li, '_tag_attribute_validation'):
    li._tag_attribute_validation()
```

---

### 2. common.py - 通用工具函数

**引用位置**: [label_studio/core/utils/common.py](file:///home/quan/work/labeling/label-studio/label_studio/core/utils/common.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk._extensions.label_studio_tools.core.utils.exceptions import LabelStudioXMLSyntaxErrorSentryIgnored` | `label_studio_sdk/_extensions/label_studio_tools/core/utils/exceptions.py` | 导入 XML 语法异常类，用于异常处理 |
| `import label_studio_sdk.converter` | `label_studio_sdk/converter/__init__.py` | 导入转换器模块，用于版本上报 |

**使用示例**:
```python
import label_studio_sdk.converter
result['label-studio-converter'] = {'version': label_studio_sdk.__version__}
```

---

### 3. data_export/models.py - 数据导出模型

**引用位置**: [label_studio/data_export/models.py](file:///home/quan/work/labeling/label-studio/label_studio/data_export/models.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.converter import Converter` | `label_studio_sdk/converter/__init__.py` | 导入转换器类，用于生成导出文件 |

**使用示例**:
```python
converter = Converter(config=project.get_parsed_config(), project_dir=None)
formats = []
supported_formats = set(converter.supported_formats)
for format, format_info in converter.all_formats().items():
    ...

converter = Converter(
    config=project.get_parsed_config(),
    project_dir=None,
    upload_dir=os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR),
    download_resources=download_resources,
    access_token=project.organization.created_by.auth_token.key,
    hostname=hostname,
)
converter.convert(input_json, tmp_dir, output_format, is_dir=False)
```

---

### 4. data_export/mixins.py - 导出混合类

**引用位置**: [label_studio/data_export/mixins.py](file:///home/quan/work/labeling/label-studio/label_studio/data_export/mixins.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.converter import Converter` | `label_studio_sdk/converter/__init__.py` | 导入转换器类，用于后台异步导出转换 |

**使用示例**:
```python
converter = Converter(
    config=self.project.get_parsed_config(),
    project_dir=None,
    upload_dir=out_dir,
    download_resources=download_resources,
    access_token=self.project.organization.created_by.auth_token.key,
    hostname=hostname,
)
converter.convert(input_file_path, out_dir, to_format, is_dir=False)
```

---

### 5. data_export/serializers.py - 导出序列化器

**引用位置**: [label_studio/data_export/serializers.py](file:///home/quan/work/labeling/label-studio/label_studio/data_export/serializers.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk._extensions.label_studio_tools.core.label_config import is_video_object_tracking` | `label_studio_sdk/_extensions/label_studio_tools/core/label_config.py` | 导入视频对象追踪检测函数 |
| `from label_studio_sdk._extensions.label_studio_tools.postprocessing.video import extract_key_frames` | `label_studio_sdk/_extensions/label_studio_tools/postprocessing/video.py` | 导入视频关键帧提取函数 |

---

### 6. projects/models.py - 项目模型

**引用位置**: [label_studio/projects/models.py](file:///home/quan/work/labeling/label-studio/label_studio/projects/models.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk._extensions.label_studio_tools.core.label_config import parse_config` | `label_studio_sdk/_extensions/label_studio_tools/core/label_config.py` | 导入配置解析函数，用于解析项目标签配置 |

---

### 7. projects/serializers.py - 项目序列化器

**引用位置**: [label_studio/projects/serializers.py](file:///home/quan/work/labeling/label-studio/label_studio/projects/serializers.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类 |
| `from label_studio_sdk.label_interface.control_tags import (...)` | `label_studio_sdk/label_interface/control_tags.py` | 导入多种控制标签类 |

**导入的控制标签类**:
- BrushLabelsTag, BrushTag
- ChoicesTag, DateTimeTag
- EllipseLabelsTag, EllipseTag
- HyperTextLabelsTag, KeyPointLabelsTag, KeyPointTag
- LabelsTag, NumberTag
- ParagraphLabelsTag, PolygonLabelsTag, PolygonTag
- RatingTag, RectangleLabelsTag, RectangleTag
- TaxonomyTag, TextAreaTag, TimeSeriesLabelsTag, VideoRectangleTag

---

### 8. projects/api.py - 项目 API

**引用位置**: [label_studio/projects/api.py](file:///home/quan/work/labeling/label-studio/label_studio/projects/api.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface.interface import LabelInterface` | `label_studio_sdk/label_interface/interface.py` | 导入标签接口类，用于 API 层的配置验证 |

---

### 9. tasks/models.py - 任务模型

**引用位置**: [label_studio/tasks/models.py](file:///home/quan/work/labeling/label-studio/label_studio/tasks/models.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface.objects import PredictionValue` | `label_studio_sdk/label_interface/objects.py` | 导入预测值对象类，用于预测数据处理 |

---

### 10. tasks/serializers.py - 任务序列化器

**引用位置**: [label_studio/tasks/serializers.py](file:///home/quan/work/labeling/label-studio/label_studio/tasks/serializers.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类，用于任务数据验证和序列化 |

---

### 11. data_import/api.py - 数据导入 API

**引用位置**: [label_studio/data_import/api.py](file:///home/quan/work/labeling/label-studio/label_studio/data_import/api.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类，用于导入数据的验证 |

---

### 12. data_import/functions.py - 数据导入函数

**引用位置**: [label_studio/data_import/functions.py](file:///home/quan/work/labeling/label-studio/label_studio/data_import/functions.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类，用于异步导入时的数据验证 |

---

### 13. cache_labels.py - 标签缓存

**引用位置**: [label_studio/data_manager/actions/cache_labels.py](file:///home/quan/work/labeling/label-studio/label_studio/data_manager/actions/cache_labels.py)

| 引用代码片段 | 被引用的 SDK 位置 | 功能描述 |
|-------------|------------------|---------|
| `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 导入标签接口类，用于缓存标签时查找控制标签 |

**使用示例**:
```python
label_interface = LabelInterface(project.label_config)
label_interface_tags = {tag.name: tag for tag in label_interface.find_tags('control')}
```

---

## 二、测试代码中的引用

### 14. SDK 测试文件

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [test_projects.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_projects.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 项目 API 测试 |
| [test_tasks.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_tasks.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 任务 API 测试 |
| [test_users.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_users.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 用户 API 测试 |
| [test_annotations.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_annotations.py) | `from label_studio_sdk.client import LabelStudio`<br>`from label_studio_sdk.data_manager import Column, Filters, Operator, Type`<br>`from label_studio_sdk.label_interface import LabelInterface`<br>`from label_studio_sdk.label_interface.create import labels`<br>`from label_studio_sdk.label_interface.objects import AnnotationValue, TaskValue` | `label_studio_sdk/client/__init__.py`<br>`label_studio_sdk/data_manager/__init__.py`<br>`label_studio_sdk/label_interface/__init__.py`<br>`label_studio_sdk/label_interface/create.py`<br>`label_studio_sdk/label_interface/objects.py` | 标注 API 测试，包含标签创建和对象类 |
| [test_predictions.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_predictions.py) | `from label_studio_sdk.client import LabelStudio`<br>`from label_studio_sdk.label_interface import LabelInterface`<br>`from label_studio_sdk.label_interface.objects import PredictionValue, TaskValue`<br>`from label_studio_sdk.core.api_error import ApiError` | `label_studio_sdk/client/__init__.py`<br>`label_studio_sdk/label_interface/__init__.py`<br>`label_studio_sdk/label_interface/objects.py`<br>`label_studio_sdk/core/api_error.py` | 预测 API 测试 |
| [test_storages.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_storages.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 存储 API 测试 |
| [test_views.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_views.py) | `from label_studio_sdk.client import LabelStudio`<br>`from label_studio_sdk.data_manager import Column, Filters, Operator, Type` | `label_studio_sdk/client/__init__.py`<br>`label_studio_sdk/data_manager/__init__.py` | 视图 API 测试，包含数据管理器组件 |
| [test_ml.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_ml.py) | `from label_studio_sdk.client import LabelStudio`<br>`from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/client/__init__.py`<br>`label_studio_sdk/label_interface/__init__.py` | ML 后端测试 |
| [test_export.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_export.py) | `from label_studio_sdk import AsyncLabelStudio`<br>`from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/client/__init__.py` | 导出 API 测试，包含异步客户端 |
| [test_prediction_validation.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_prediction_validation.py) | `from label_studio_sdk import LabelStudio` | `label_studio_sdk/__init__.py` | 预测验证测试 |
| [test_project_annotators_api.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/test_project_annotators_api.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 项目标注员 API 测试 |
| [fixtures.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/fixtures.py) | `from label_studio_sdk.client import LabelStudio`<br>`from label_studio_sdk.data_manager import Column, Filters, Operator, Type` | `label_studio_sdk/client/__init__.py`<br>`label_studio_sdk/data_manager/__init__.py` | 测试夹具 |

### 15. Legacy SDK 测试文件

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [legacy/test_projects.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_projects.py) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 旧版项目 API 测试 |
| [legacy/test_tasks.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_tasks.py) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 旧版任务 API 测试 |
| [legacy/test_users.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_users.py) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 旧版用户 API 测试 |
| [legacy/test_annotations.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_annotations.py) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 旧版标注 API 测试 |
| [legacy/test_storages.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_storages.py) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 旧版存储 API 测试 |
| [legacy/test_views.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/sdk/legacy/test_views.py) | `from label_studio_sdk import Client`<br>`from label_studio_sdk.data_manager import Column, Filters, Operator, Type` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/data_manager/__init__.py` | 旧版视图 API 测试 |

### 16. 其他测试文件

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [test_prediction_validation.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/test_prediction_validation.py) | `from label_studio_sdk.label_interface import LabelInterface` | `label_studio_sdk/label_interface/__init__.py` | 预测验证测试 |
| [test_session_policy_sdk.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/test_session_policy_sdk.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 会话策略 SDK 测试 |
| [test_fsm_lso_workflows.py](file:///home/quan/work/labeling/label-studio/label_studio/tests/test_fsm_lso_workflows.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | FSM 工作流测试 |
| [test_task_annotation_workflows.py](file:///home/quan/work/labeling/label-studio/label_studio/fsm/tests/test_task_annotation_workflows.py) | `from label_studio_sdk.label_interface.objects import TaskValue` | `label_studio_sdk/label_interface/objects.py` | FSM 任务标注工作流测试 |
| [helpers.py](file:///home/quan/work/labeling/label-studio/label_studio/fsm/tests/helpers.py) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | FSM 测试辅助函数 |

---

## 三、文档文件中的引用

### 17. 教程文档

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [how_to_review_langsmith_traces_with_label_studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_review_langsmith_traces_with_label_studio.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.core.request_options import RequestOptions` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/core/request_options.py` | LangSmith 追踪审核教程 |
| [how_to_review_langfuse_traces_with_label_studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_review_langfuse_traces_with_label_studio.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.core.request_options import RequestOptions` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/core/request_options.py` | LangFuse 追踪审核教程 |
| [how_to_review_braintrust_traces_with_label_studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_review_braintrust_traces_with_label_studio.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.core.request_options import RequestOptions` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/core/request_options.py` | Braintrust 追踪审核教程 |
| [how_to_multi_turn_chat_evals_with_chainlit_and_label_studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_multi_turn_chat_evals_with_chainlit_and_label_studio.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/client/__init__.py` | Chainlit 多轮对话评估教程 |
| [how_to_measure_inter_annotator_agreement_and_build_human_consensus.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_measure_inter_annotator_agreement_and_build_human_consensus.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.types import ImportApiRequest, PredictionRequest`<br>`from label_studio_sdk.projects.assignments import AssignmentsBulkAssignRequestSelectedItemsIncluded` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/types/__init__.py`<br>`label_studio_sdk/projects/assignments.py` | 标注者一致性测量教程 |
| [how_to_embed_evaluation_workflows_in_your_research_stack_with_Label_Studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_embed_evaluation_workflows_in_your_research_stack_with_Label_Studio.md) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | 评估工作流嵌入教程 |
| [how_to_debug_agents_with_LangSmith_and_Label_Studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_debug_agents_with_LangSmith_and_Label_Studio.md) | `from label_studio_sdk.client import LabelStudio` | `label_studio_sdk/client/__init__.py` | LangSmith 代理调试教程 |
| [how_to_create_a_Benchmark_and_Evaluate_your_models_with_Label_Studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_create_a_Benchmark_and_Evaluate_your_models_with_Label_Studio.md) | `from label_studio_sdk import LabelStudio` | `label_studio_sdk/__init__.py` | 模型基准测试教程 |
| [how_to_connect_Hugging_Face_with_Label_Studio_SDK.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_connect_Hugging_Face_with_Label_Studio_SDK.md) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | Hugging Face 集成教程 |
| [how_to_compare_two_ai_models_with_label_studio.md](file:///home/quan/work/labeling/label-studio/docs/source/tutorials/how_to_compare_two_ai_models_with_label_studio.md) | `from label_studio_sdk import LabelStudio`<br>`from label_studio_sdk.core.api_error import ApiError` | `label_studio_sdk/__init__.py`<br>`label_studio_sdk/core/api_error.py` | AI 模型比较教程 |

### 18. 模板文档

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [video_object_detector.md](file:///home/quan/work/labeling/label-studio/docs/source/templates/video_object_detector.md) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 视频对象检测模板 |
| [generative-visual-ranker.md](file:///home/quan/work/labeling/label-studio/docs/source/templates/generative-visual-ranker.md) | `import label_studio_sdk`<br>`from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 生成式视觉排序器模板 |
| [generative-supervised-llm.md](file:///home/quan/work/labeling/label-studio/docs/source/templates/generative-supervised-llm.md) | `import label_studio_sdk`<br>`from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 生成式监督 LLM 模板 |
| [generative-pairwise-human-preference.md](file:///home/quan/work/labeling/label-studio/docs/source/templates/generative-pairwise-human-preference.md) | `from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 生成式成对人类偏好模板 |
| [generative-llm-ranker.md](file:///home/quan/work/labeling/label-studio/docs/source/templates/generative-llm-ranker.md) | `import label_studio_sdk`<br>`from label_studio_sdk import Client` | `label_studio_sdk/__init__.py` | 生成式 LLM 排序器模板 |

### 19. 指南文档

| 文件路径 | 引用内容 | 被引用的 SDK 位置 | 功能描述 |
|---------|---------|------------------|---------|
| [sdk.md](file:///home/quan/work/labeling/label-studio/docs/source/guide/sdk.md) | `from label_studio_sdk import LabelStudio` | `label_studio_sdk/__init__.py` | SDK 使用指南 |
| [api.md](file:///home/quan/work/labeling/label-studio/docs/source/guide/api.md) | `from label_studio_sdk import LabelStudio` | `label_studio_sdk/__init__.py` | API 使用指南 |
| [access_tokens.md](file:///home/quan/work/labeling/label-studio/docs/source/guide/access_tokens.md) | `from label_studio_sdk import LabelStudio` | `label_studio_sdk/__init__.py` | 访问令牌使用指南 |

---

## 四、配置与元数据文件中的引用

### 20. 项目文档

| 文件路径 | 引用内容 | 功能描述 |
|---------|---------|---------|
| [AGENTS.md](file:///home/quan/work/labeling/label-studio/AGENTS.md) | 提及 `label-studio-sdk` | AI 代理工作指南，描述 SDK 作为生态系统成员 |
| [CONTRIBUTING.md](file:///home/quan/work/labeling/label-studio/CONTRIBUTING.md) | 提及 `label-studio-sdk` | 贡献指南 |
| [README.md](file:///home/quan/work/labeling/label-studio/README.md) | 提及 `label-studio-sdk` | 项目说明文档 |
| [INSTALL.md](file:///home/quan/work/labeling/label-studio/INSTALL.md) | 提及 `label-studio-sdk` | 安装指南 |
| [DEPENDENCY.md](file:///home/quan/work/labeling/label-studio/understand/dependency/DEPENDENCY.md) | 详细分析 SDK 依赖与使用 | 依赖分析文档，包含完整的 SDK 引用分析 |

### 21. CI/CD 配置

| 文件路径 | 引用内容 | 功能描述 |
|---------|---------|---------|
| [submodules-validator.yml](file:///home/quan/work/labeling/label-studio/.github/workflows/submodules-validator.yml) | 提及 `label-studio-sdk` | 子模块验证工作流 |
| [build_pypi.yml](file:///home/quan/work/labeling/label-studio/.github/workflows/build_pypi.yml) | 提及 `label-studio-sdk` | PyPI 构建工作流 |

### 22. 编码规范

| 文件路径 | 引用内容 | 功能描述 |
|---------|---------|---------|
| [storage-provider.mdc](file:///home/quan/work/labeling/label-studio/.cursor/rules/storage-provider.mdc) | 提及 `label-studio-sdk` | 存储提供者编码规范 |

---

## 五、依赖声明

**依赖位置**: [pyproject.toml](file:///home/quan/work/labeling/label-studio/pyproject.toml)

```toml
"label-studio-sdk @ https://github.com/HumanSignal/label-studio-sdk/archive/54d1aeca71fe7b572c8028e7fe82c4b54457e8f0.zip"
```

SDK 作为核心依赖通过 GitHub 归档链接引入，使用特定 commit 版本。

---

## 六、引用统计

### SDK 模块引用统计

| SDK 模块 | 引用次数 | 主要用途 |
|---------|---------|---------|
| `label_studio_sdk.label_interface` | 12 | 标签配置解析和验证 |
| `label_studio_sdk.converter` | 3 | 数据导出格式转换 |
| `label_studio_sdk.client` | 15 | API 客户端（测试） |
| `label_studio_sdk._extensions.label_studio_tools` | 5 | 扩展工具函数 |
| `label_studio_sdk._legacy` | 2 | 旧版异常处理 |
| `label_studio_sdk.data_manager` | 4 | 数据管理器组件（测试） |

### 文件类型分布

| 文件类型 | 文件数量 | 说明 |
|---------|---------|------|
| Python 核心业务代码 | 13 | 直接 import SDK 模块驱动业务逻辑 |
| Python 测试代码 | 21 | 使用 SDK 客户端进行 API 测试 |
| Markdown 教程文档 | 10 | 提供 SDK 使用示例 |
| Markdown 模板文档 | 5 | 提供模板项目的 SDK 配置示例 |
| Markdown 指南文档 | 3 | SDK 官方使用说明 |
| 项目文档 | 5 | 项目说明与贡献指南 |
| CI/CD 配置 | 2 | GitHub Actions 工作流 |
| 编码规范 | 1 | Cursor 规则文件 |

### SDK 客户端使用方式对比

| 客户端类型 | 导入方式 | 使用场景 |
|-----------|---------|---------|
| `LabelStudio`（新版） | `from label_studio_sdk import LabelStudio` 或 `from label_studio_sdk.client import LabelStudio` | 新版 API 客户端，用于教程和测试 |
| `AsyncLabelStudio`（异步） | `from label_studio_sdk import AsyncLabelStudio` | 异步 API 客户端，用于导出测试 |
| `Client`（旧版） | `from label_studio_sdk import Client` | 旧版 API 客户端，用于 legacy 测试和部分模板 |

---

## 七、与 DEPENDENCY.md 的关系

本文件与 [understand/dependency/DEPENDENCY.md](file:///home/quan/work/labeling/label-studio/understand/dependency/DEPENDENCY.md) 互补：

- **DEPENDENCY.md**：侧重于依赖的整体分析，包括版本声明、License、浸入程度、与其他依赖的关系
- **USAGE.md**：侧重于 SDK 代码的具体引用位置、代码片段和功能描述，提供更详细的使用场景分析
