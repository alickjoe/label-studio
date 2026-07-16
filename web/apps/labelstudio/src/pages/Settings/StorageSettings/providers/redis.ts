import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderRedis } from "@humansignal/icons";

export const redisProvider: ProviderConfig = {
  name: "redis",
  title: "Redis Storage",
  description: "配置 Redis 存储连接的所有必需 Label Studio 设置",
  icon: IconCloudProviderRedis,
  fields: [
    {
      name: "db",
      type: "text",
      label: "数据库编号 (db)",
      placeholder: "1",
      schema: z.string().default("1"),
    },
    {
      name: "password",
      type: "password",
      label: "密码",
      autoComplete: "new-password",
      placeholder: "您的 Redis 密码",
      schema: z.string().optional().default(""),
    },
    {
      name: "host",
      type: "text",
      label: "主机",
      required: true,
      placeholder: "redis://example.com",
      schema: z.string().min(1, "主机为必填项"),
    },
    {
      name: "port",
      type: "text",
      label: "端口",
      placeholder: "6379",
      schema: z.string().default("6379"),
    },
    {
      name: "prefix",
      type: "text",
      label: "存储桶前缀",
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
  ],
  layout: [{ fields: ["host", "port", "db", "password"] }, { fields: ["prefix"] }],
};

export default redisProvider;
