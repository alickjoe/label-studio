import { format } from "date-fns/esm";
import { Button, CodeBlock, IconFileCopy, Space, Tooltip } from "@humansignal/ui";
import { DescriptionList } from "../../../components/DescriptionList/DescriptionList";
import { modal } from "../../../components/Modal/Modal";
import { Oneof } from "../../../components/Oneof/Oneof";
import { getLastTraceback } from "../../../utils/helpers";
import { useCopyText } from "@humansignal/core";

// Component to handle copy functionality within the modal
const CopyButton = ({ msg }) => {
  const [copyText, copied] = useCopyText({ defaultText: msg });

  return (
    <Button variant="neutral" icon={<IconFileCopy />} onClick={() => copyText()} disabled={copied} className="w-[7rem]">
      {copied ? "已复制！" : "复制"}
    </Button>
  );
};

export const StorageSummary = ({ target, storage, className, storageTypes = [] }) => {
  const storageStatus = storage.status.replace(/_/g, " ").replace(/(^\w)/, (match) => match.toUpperCase());
  const storageStatusLabel = {
    Initialized: "已初始化",
    Queued: "排队中",
    "In progress": "进行中",
    Failed: "失败",
    "Completed with errors": "完成但有错误",
    Completed: "已完成",
  }[storageStatus] ?? storageStatus;
  const last_sync_count = storage.last_sync_count ? storage.last_sync_count : 0;

  const tasks_existed =
    typeof storage.meta?.tasks_existed !== "undefined" && storage.meta?.tasks_existed !== null
      ? storage.meta.tasks_existed
      : 0;
  const total_annotations =
    typeof storage.meta?.total_annotations !== "undefined" && storage.meta?.total_annotations !== null
      ? storage.meta.total_annotations
      : 0;

  // help text for tasks and annotations
  const tasks_added_help = `上次同步期间新增了 ${last_sync_count} 个任务。`;
  const tasks_total_help = [
    `${tasks_existed} 个已找到并已同步的任务不会再次添加到项目中。`,
    `此存储总共已添加 ${tasks_existed + last_sync_count} 个任务。`,
  ].join("\n");
  const annotations_help = `上次同步期间成功保存了 ${last_sync_count} 条标注。`;
  const total_annotations_help =
    typeof storage.meta?.total_annotations !== "undefined"
      ? `同步时刻项目中总共可见 ${storage.meta.total_annotations} 条标注。`
      : "";

  const handleButtonClick = () => {
    const msg =
      `项目 ${storage.project} 中存储 ${storage.id}（${target === "export" ? "导出 " : ""}${storage.type}）的 ` +
      `错误日志，任务 ${storage.last_sync_job}：\n\n` +
      `${getLastTraceback(storage.traceback)}\n\n` +
      `meta = ${JSON.stringify(storage.meta)}\n`;

    const currentModal = modal({
      title: "存储同步错误日志",
      body: <CodeBlock code={msg} variant="negative" className="max-h-[50vh] overflow-y-auto" />,
      footer: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {!window.APP_SETTINGS?.whitelabel_is_active && (
            <div>
              <>
                <a
                  href="https://labelstud.io/guide/storage.html#Troubleshooting"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="了解更多关于云存储故障排查的信息"
                >
                  查看文档
                </a>{" "}
                获取云存储连接的故障排查建议。
              </>
            </div>
          )}
          <Space>
            <CopyButton msg={msg} />
            <Button variant="primary" className="w-[7rem]" onClick={() => currentModal.close()}>
              关闭
            </Button>
          </Space>
        </div>
      ),
      style: { width: "700px" },
      optimize: false,
      allowClose: true,
    });
  };

  return (
    <div className={className}>
      <DescriptionList>
        <DescriptionList.Item term="类型">
          {(storageTypes ?? []).find((s) => s.name === storage.type)?.title ?? storage.type}
        </DescriptionList.Item>

        <Oneof value={storage.type}>
          <SummaryS3 case={["s3", "s3s"]} storage={storage} />
          <GSCStorage case="gcs" storage={storage} />
          <AzureStorage case="azure" storage={storage} />
          <RedisStorage case="redis" storage={storage} />
          <LocalStorage case="localfiles" storage={storage} />
        </Oneof>

        <DescriptionList.Item
          term="状态"
          help={[
            "已初始化：存储已添加但从未同步；足以开始 URI 链接解析",
            "排队中：同步任务已在队列中但尚未开始",
            "进行中：同步任务正在运行",
            "失败：同步任务已停止，出现了一些错误",
            "完成但有错误：同步任务已完成但部分任务存在验证错误",
            "已完成：同步任务已成功完成",
          ].join("\n")}
        >
          {storageStatus === "Failed" || storageStatus === "Completed with errors" ? (
            <span
              className="cursor-pointer border-b border-dashed border-negative-border-subtle text-negative-content"
              onClick={handleButtonClick}
            >
              {storageStatusLabel}（查看日志）
            </span>
          ) : (
            storageStatusLabel
          )}
        </DescriptionList.Item>

        {target === "export" ? (
          <DescriptionList.Item term="标注" help={`${annotations_help}\n${total_annotations_help}`}>
            <Tooltip title={annotations_help}>
              <span>{last_sync_count}</span>
            </Tooltip>
            <Tooltip title={total_annotations_help}>
              <span>（共 {total_annotations} 条）</span>
            </Tooltip>
          </DescriptionList.Item>
        ) : (
          <DescriptionList.Item term="任务" help={`${tasks_added_help}\n${tasks_total_help}`}>
            <Tooltip title={`${tasks_added_help}\n${tasks_total_help}`} style={{ whiteSpace: "pre-wrap" }}>
              <span>{last_sync_count + tasks_existed}</span>
            </Tooltip>
            <Tooltip title={tasks_added_help}>
              <span>（新增 {last_sync_count} 个）</span>
            </Tooltip>
          </DescriptionList.Item>
        )}

        <DescriptionList.Item term="上次同步">
          {storage.last_sync ? format(new Date(storage.last_sync), "yyyy 年 MM 月 dd 日 ∙ HH:mm:ss") : "尚未同步"}
        </DescriptionList.Item>
      </DescriptionList>
    </div>
  );
};

const SummaryS3 = ({ storage }) => {
  return <DescriptionList.Item term="存储桶">{storage.bucket}</DescriptionList.Item>;
};

const GSCStorage = ({ storage }) => {
  return <DescriptionList.Item term="存储桶">{storage.bucket}</DescriptionList.Item>;
};

const AzureStorage = ({ storage }) => {
  return <DescriptionList.Item term="容器">{storage.container}</DescriptionList.Item>;
};

const RedisStorage = ({ storage }) => {
  return (
    <>
      <DescriptionList.Item term="路径">{storage.path}</DescriptionList.Item>
      <DescriptionList.Item term="主机">
        {storage.host}
        {storage.port ? `:${storage.port}` : ""}
      </DescriptionList.Item>
    </>
  );
};

const LocalStorage = ({ storage }) => {
  return <DescriptionList.Item term="路径">{storage.path}</DescriptionList.Item>;
};
