import type { TipsCollection } from "./types";

export const defaultTipsCollection: TipsCollection = {
  projectCreation: [
    {
      title: "你知道吗？",
      content: "使用 Label Studio 企业版将项目组织到工作区中，可以更轻松地查找项目。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/manage_projects#Create-workspaces-to-organize-projects",
        params: {
          experiment: "project_creation_tip",
          treatment: "find_and_manage_projects",
        },
      },
    },
    {
      title: "解锁更快的访问配置",
      content: "通过在 Label Studio 企业版中将员工分配到工作区，简化将员工分配到多个项目的流程。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/manage_projects#Add-or-remove-members-to-a-workspace",
        params: {
          experiment: "project_creation_tip",
          treatment: "faster_provisioning",
        },
      },
    },
    {
      title: "你知道吗？",
      content:
        "在企业版平台中，管理员可以查看标注员绩效仪表板，以优化资源分配、改进团队管理并为薪酬决策提供依据。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/dashboard_annotator",
        params: {
          experiment: "project_creation_tip",
          treatment: "annotator_dashboard",
        },
      },
    },
    {
      title: "你知道吗？",
      content: "你可以使用 Label Studio 企业版控制内部团队成员和外部标注员对特定项目和工作区的访问权限。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/manage_users#Roles-in-Label-Studio-Enterprise",
        params: {
          experiment: "project_creation_tip",
          treatment: "access_to_projects",
        },
      },
    },
    {
      title: "你知道吗？",
      content:
        "你可以使用或修改数十种模板来配置标注界面，也可以使用简单的类 XML 标签从头创建自定义配置。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://labelstud.io/guide/setup",
        params: {
          experiment: "project_creation_tip",
          treatment: "templates",
        },
      },
    },
    {
      title: "面向 GenAI 的标注",
      content: "Label Studio 提供用于监督式 LLM 微调、RAG 检索排序、RLHF、聊天机器人评估等场景的模板。",
      closable: true,
      link: {
        label: "探索模板",
        url: "https://labelstud.io/templates/gallery_generative_ai",
        params: {
          experiment: "project_creation_tip",
          treatment: "genai_templates",
        },
      },
    },
  ],
  organizationPage: [
    {
      title: "看起来你的团队正在壮大！",
      content: "使用 Label Studio 企业版为团队分配角色，并在项目和工作区级别控制对敏感数据的访问。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/manage_users#Roles-in-Label-Studio-Enterprise",
        params: {
          experiment: "organization_page_tip",
          treatment: "team_growing",
        },
      },
    },
    {
      title: "想要简化和保护登录吗？",
      content: "使用 Label Studio 企业版通过 SAML、SCIM2 或 LDAP 为团队启用单点登录。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/auth_setup",
        params: {
          experiment: "organization_page_tip",
          treatment: "enable_sso",
        },
      },
    },
    {
      title: "你知道吗？",
      content: "试试专为小型团队和项目优化的 Label Studio 入门级云服务。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://humansignal.com/pricing/",
        params: {
          experiment: "organization_page_tip",
          treatment: "starter_cloud_live",
        },
      },
    },
    {
      title: "想要自动化任务分配吗？",
      content: "创建规则，自动化任务向标注员的分配方式，并在每位标注员的视图中仅显示分配给他们的任务，同时控制每位标注员的任务可见性。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/setup_project#Set-up-annotation-settings-for-your-project",
        params: {
          experiment: "organization_page_tip",
          treatment: "automate_distribution",
        },
      },
    },
    {
      title: "与社区分享知识",
      content: "有疑问或想与其他 Label Studio 用户分享技巧？加入社区 Slack 频道获取最新更新。",
      closable: true,
      link: {
        label: "加入社区",
        url: "https://label-studio.slack.com",
        params: {
          experiment: "organization_page_tip",
          treatment: "share_knowledge",
        },
      },
    },
    {
      title: "你知道吗？",
      content:
        "Label Studio 支持与云存储、机器学习模型和常用工具的多点集成，以自动化你的机器学习流水线。",
      closable: true,
      link: {
        label: "查看集成目录",
        url: "https://labelstud.io/integrations/",
        params: {
          experiment: "organization_page_tip",
          treatment: "integration_points",
        },
      },
    },
  ],
  projectSettings: [
    {
      title: "将你的 AWS 支出应用于 Label Studio 企业版",
      content: "Label Studio 企业版现已在 AWS Marketplace 上线，你可以使用承诺支出简化数据标注工作流。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://aws.amazon.com/marketplace/pp/prodview-wjac3msf77tny",
        params: {
          experiment: "project_settings_tip",
          treatment: "aws_marketplace",
        },
      },
    },
    {
      title: "使用自动标注节省时间",
      content: "在企业版平台中使用自动化功能，在不牺牲质量的情况下即时标注大规模数据集。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/prompts_overview#Auto-labeling-with-Prompts",
        params: {
          experiment: "project_settings_tip",
          treatment: "auto_labeling",
        },
      },
    },
    {
      title: "你知道吗？",
      content: "使用 Label Studio 企业版，你可以通过审核工作流和任务一致性分数提高标注数据的质量。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://docs.humansignal.com/guide/quality",
        params: {
          experiment: "project_settings_tip",
          treatment: "quality_and_agreement",
        },
      },
    },
    {
      title: "评估 GenAI 模型",
      content: "在企业版平台中结合自动化和人工监督，以评估并确保 LLM 质量。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://humansignal.com/evals/",
        params: {
          experiment: "project_settings_tip",
          treatment: "evals",
        },
      },
    },
    {
      title: "你知道吗？",
      content:
        "使用企业版云服务，你可以节省管理基础设施和升级的时间，并访问更多用于自动化、质量和团队管理的功能。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://humansignal.com/platform/",
        params: {
          experiment: "project_settings_tip",
          treatment: "infrastructure_and_upgrades",
        },
      },
    },
    {
      title: "你知道吗？",
      content: "试试专为小型团队和项目优化的 Label Studio 入门级云服务。",
      link: {
        label: "了解更多",
        url: "https://humansignal.com/pricing/",
        params: {
          experiment: "project_settings_tip",
          treatment: "starter_cloud_live",
        },
      },
    },
    {
      title: "你知道吗？",
      content: "你可以使用后端 SDK 连接 ML 模型，通过预标注或主动学习节省时间。",
      closable: true,
      link: {
        label: "了解更多",
        url: "https://labelstud.io/guide/ml",
        params: {
          experiment: "project_settings_tip",
          treatment: "connect_ml_models",
        },
      },
    },
  ],
};
