import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderAzure } from "@humansignal/icons";
import { z } from "zod";

export const azureProvider: ProviderConfig = {
  name: "azure",
  title: "Azure Blob Storage",
  description: "配置 Azure Blob Storage 连接的所有必需 Label Studio 设置",
  icon: IconCloudProviderAzure,
  fields: [
    {
      name: "container",
      type: "text",
      label: "容器名称",
      required: true,
      placeholder: "my-azure-container",
      schema: z.string().min(1, "容器名称为必填项"),
    },
    {
      name: "prefix",
      type: "text",
      label: "存储桶前缀",
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
    {
      name: "account_name",
      type: "password",
      label: "账户名称",
      autoComplete: "off",
      accessKey: true,
      placeholder: "mystorageaccount",
      schema: z.string().optional().default(""),
    },
    {
      name: "account_key",
      type: "password",
      label: "账户密钥",
      autoComplete: "new-password",
      accessKey: true,
      placeholder: "您的存储账户密钥",
      schema: z.string().optional().default(""),
    },
    {
      name: "presign",
      type: "toggle",
      label: "使用预签名 URL（开启）/ 通过平台代理（关闭）",
      description:
        "启用预签名 URL 时，所有数据将绕过平台，用户浏览器直接从存储读取数据",
      schema: z.boolean().default(true),
      target: "import",
      resetConnection: false,
    },
    {
      name: "presign_ttl",
      type: "counter",
      label: "预签名 URL 过期时间（分钟）",
      min: 1,
      max: 10080,
      step: 1,
      schema: z.number().min(1).max(10080).default(15),
      target: "import",
      resetConnection: false,
      dependsOn: {
        field: "presign",
        value: true,
      },
    },
  ],
  layout: [
    { fields: ["container"] },
    { fields: ["prefix"] },
    { fields: ["account_name"] },
    { fields: ["account_key"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};

export default azureProvider;
