import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderDatabricks } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";

const databricksProvider: ProviderConfig = {
  name: "databricks",
  title: "Databricks 文件\n（UC 卷）",
  description: "配置 Databricks Unity Catalog 卷连接的所有必需设置（仅代理）",
  icon: IconCloudProviderDatabricks,
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
            Databricks 文件（UC 卷）在 Label Studio 企业版中可用。{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Databricks-Files-UC-Volumes"
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

export default databricksProvider;
