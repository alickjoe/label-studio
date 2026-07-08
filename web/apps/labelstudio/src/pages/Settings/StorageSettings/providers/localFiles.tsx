import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconFolderOpen } from "@humansignal/icons";
import { Alert, AlertDescription, AlertTitle } from "@humansignal/shad/components/ui/alert";

const localFilesDocumentRoot =
  typeof window === "undefined" ? undefined : window.APP_SETTINGS?.local_files_document_root;
const localFilesServingEnabled =
  typeof window === "undefined" ? true : window.APP_SETTINGS?.local_files_serving_enabled !== false;
const isCommunityEdition =
  typeof window === "undefined" ? false : window.APP_SETTINGS?.version?.edition === "Community";
const trimTrailingSeparators = (value?: string) => value?.replace(/[/\\]+$/, "");
const defaultPathExample = localFilesDocumentRoot
  ? `${trimTrailingSeparators(localFilesDocumentRoot)}/your-subdirectory`
  : undefined;

const pathSchema = defaultPathExample
  ? z.string().min(1, "路径为必填项").default(defaultPathExample)
  : z.string().min(1, "路径为必填项");

const LocalFilesServingWarning = () => {
  if (localFilesServingEnabled) return null;
  return (
    <>
      <Alert variant="destructive">
        <AlertTitle>本地文件服务已禁用</AlertTitle>
        <AlertDescription>
          将 "LOCAL_FILES_SERVING_ENABLED" 环境变量设置为 "true" 并重启 Label Studio 以启用本地文件存储。详情请参阅文档：{" "}
          <a href="https://labelstud.io/guide/storage.html#Local-storage" target="_blank" rel="noreferrer">
            本地存储文档
          </a>
          {isCommunityEdition && (
            <Alert variant="info">
              <AlertDescription>
                <p>
                  提示：在运行 Label Studio 的命令旁边创建 "mydata" 或 "label-studio-data" 目录，本地文件服务将自动启用。
                </p>
                <p>
                  如果您运行 Docker 镜像，应用启动路径为 "/label-studio"，因此您可以将主机文件夹绑定挂载到容器内的 "/label-studio/mydata" 或 "/label-studio/label-studio-data" 以启用本地文件服务，无需额外配置。
                </p>
              </AlertDescription>
            </Alert>
          )}
        </AlertDescription>
      </Alert>
    </>
  );
};

export const localFilesProvider: ProviderConfig = {
  name: "localfiles",
  title: "本地文件",
  description: "配置本地文件存储连接的所有必需 Label Studio 设置",
  icon: () => (
    <IconFolderOpen
      width={40}
      height={40}
      style={{
        color: "var(--color-accent-canteloupe-base)",
        filter: "drop-shadow(0px 0px 12px var(--color-accent-canteloupe-base))",
      }}
    />
  ),
  fields: [
    {
      name: "serving_warning",
      type: "message",
      content: LocalFilesServingWarning,
    },
    {
      name: "path",
      type: "text",
      label: "本地绝对路径",
      required: true,
      placeholder: defaultPathExample || "/data/my-folder/subdirectory",
      schema: pathSchema,
      defaultValue: defaultPathExample,
      description: `此路径必须是运行 Label Studio 的主机上的绝对路径，并以 \n"${localFilesDocumentRoot}" (LOCAL_FILES_DOCUMENT_ROOT) 开头。`,
    },
  ],
  layout: [{ fields: ["serving_warning"] }, { fields: ["path"] }],
};

export default localFilesProvider;
