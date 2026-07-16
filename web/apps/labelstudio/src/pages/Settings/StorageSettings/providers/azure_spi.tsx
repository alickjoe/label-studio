import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderAzure } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";

const azureSpiProvider: ProviderConfig = {
  name: "azure_spi",
  title: "Azure Blob Storage\n使用服务主体",
  description:
    "使用服务主体认证配置 Azure Blob Storage 连接，以增强安全性（仅代理）",
  icon: IconCloudProviderAzure,
  disabled: true,
  badge: <EnterpriseBadge />,
  fields: [
    {
      name: "enterprise_info",
      type: "message",
      content: (
        <Alert variant="gradient">
          <IconSpark />
          <AlertTitle>企业版功能</AlertTitle>
          <AlertDescription>
            使用服务主体的 Azure Blob Storage 在 Label Studio 企业版中可用。{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Azure-Blob-Storage-with-Service-Principal-authentication"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              了解更多
            </a>
          </AlertDescription>
        </Alert>
      ),
    },
  ],
  layout: [{ fields: ["enterprise_info"] }],
};

export default azureSpiProvider;
