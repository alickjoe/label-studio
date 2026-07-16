import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderGCS } from "@humansignal/icons";

export const gcsProvider: ProviderConfig = {
  name: "gcs",
  title: "Google Cloud Storage",
  description: "配置 Google Cloud Storage 连接的所有必需 Label Studio 设置",
  icon: IconCloudProviderGCS,
  fields: [
    {
      name: "bucket",
      type: "text",
      label: "存储桶名称",
      required: true,
      schema: z.string().min(1, "存储桶名称为必填项"),
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
      name: "google_application_credentials",
      type: "password",
      label: "Google 应用凭据",
      description: "将 credentials.json 的内容粘贴到此字段，或留空以使用 ADC。",
      autoComplete: "new-password",
      accessKey: true,
      schema: z.string().optional().default(""), // JSON validation could be added if needed
    },
    {
      name: "google_project_id",
      type: "text",
      label: "Google 项目 ID",
      description: "留空以从 Google 应用凭据继承。",
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
    { fields: ["bucket"] },
    { fields: ["prefix"] },
    { fields: ["google_application_credentials"] },
    { fields: ["google_project_id"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};

export default gcsProvider;
