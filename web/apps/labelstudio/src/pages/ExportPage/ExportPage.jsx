import { useEffect, useRef, useState, useCallback } from "react";
import { useHistory } from "react-router";
import { Button, Badge } from "@humansignal/ui";
import {
  IconWarningCircleFilled,
  IconTerminal,
  IconCode,
  IconBook,
  IconExternal,
  IconCopyOutline,
} from "@humansignal/icons";
import { Form, Input } from "../../components/Form";
import { Modal } from "../../components/Modal/Modal";
import { Space } from "../../components/Space/Space";
import { useAPI } from "../../providers/ApiProvider";
import { useFixedLocation, useParams } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { isDefined, copyText } from "../../utils/helpers";
import "./ExportPage.prefix.css";

// Community Edition exports run synchronously in a single HTTP request.
// Large exports can exceed typical proxy timeouts, so we warn early and link to alternatives.
const LARGE_EXPORT_TASK_THRESHOLD = 1000;
const EXPORT_TIMEOUT_DOCS_URL = "https://labelstud.io/guide/export.html#Export-timeout-in-Community-Edition";
const EXPORT_CONSOLE_DOCS_URL = "https://labelstud.io/guide/export.html#Export-using-console-command";
const EXPORT_SNAPSHOT_SDK_URL = "https://api.labelstud.io/api-reference/api-reference/projects/exports/create";
const ENTERPRISE_URL = "https://docs.humansignal.com/guide/label_studio_compare";

// const formats = {
//   json: 'JSON',
//   csv: 'CSV',
// };

const downloadFile = (blob, filename) => {
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 5000));

const isTimeoutLikeStatus = (status) => status === 408 || status === 502 || status === 504;

export const ExportPage = () => {
  const history = useHistory();
  const location = useFixedLocation();
  const pageParams = useParams();
  const api = useAPI();

  const [previousExports, setPreviousExports] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMessage, setDownloadingMessage] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [currentFormat, setCurrentFormat] = useState("JSON");
  const [projectTaskNumber, setProjectTaskNumber] = useState(null);
  const [exportIssue, setExportIssue] = useState(null);

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const proceedExport = async () => {
    setExportIssue(null);
    setDownloading(true);

    const messageTimer = window.setTimeout(() => {
      setDownloadingMessage(true);
    }, 1000);

    try {
      const params = form.current.assembleFormData({
        asJSON: true,
        full: true,
        booleansAsNumbers: true,
      });

      const response = await api.callApi("exportRaw", {
        params: {
          pk: pageParams.id,
          ...params,
        },
      });

      // The API proxy can return `null` for certain network errors; treat it as timeout-like
      // and show actionable guidance instead of a generic error.
      if (!response) {
        setExportIssue("timeout");
        return;
      }

      if (response.ok) {
        const blob = await response.blob();

        downloadFile(blob, response.headers.get("filename"));
        return;
      }

      if (isTimeoutLikeStatus(response.status)) {
        setExportIssue("timeout");
        return;
      }

      api.handleError(response);
    } finally {
      window.clearTimeout(messageTimer);
      setDownloading(false);
      setDownloadingMessage(false);
    }
  };

  useEffect(() => {
    if (isDefined(pageParams.id)) {
      let cancelled = false;

      api
        .callApi("previousExports", {
          params: {
            pk: pageParams.id,
          },
        })
        .then(({ export_files }) => {
          if (!cancelled) setPreviousExports(export_files.slice(0, 1));
        });

      api
        .callApi("exportFormats", {
          params: {
            pk: pageParams.id,
          },
        })
        .then((formats) => {
          if (cancelled) return;
          setAvailableFormats(formats);
          setCurrentFormat(formats[0]?.name);
        });

      // Fetch project metadata to show a proactive warning for large exports.
      // This is best-effort and should not trigger global error UI if it fails.
      api
        .callApi("project", {
          params: { pk: pageParams.id },
          errorFilter: () => true,
        })
        .then((project) => {
          if (cancelled) return;
          setProjectTaskNumber(project?.task_number ?? null);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [pageParams.id]);

  return (
    <Modal
      onHide={() => {
        const path = location.pathname.replace(ExportPage.path, "");
        const search = location.search;

        history.replace(`${path}${search !== "?" ? search : ""}`);
      }}
      title="导出数据"
      style={{ width: 720 }}
      closeOnClickOutside={false}
      allowClose={!downloading}
      // footer="Read more about supported export formats in the Documentation."
      visible
    >
      <div className={cn("export-page").toClassName()}>
        <FormatInfo
          availableFormats={availableFormats}
          selected={currentFormat}
          onClick={(format) => setCurrentFormat(format.name)}
        />

        <ExportLargeProjectWarning taskCount={projectTaskNumber} />
        {exportIssue === "timeout" && <ExportTimeoutGuidance projectId={pageParams.id} exportType={currentFormat} />}

        <Form ref={form}>
          <Input type="hidden" name="exportType" value={currentFormat} />
        </Form>

        <div className={cn("export-page").elem("footer").toClassName()}>
          {downloadingMessage && (
            <div className={cn("export-page").elem("status-message").toClassName()}>
              正在准备文件，可能需要较长时间。
            </div>
          )}
          <Space style={{ width: "100%" }} spread>
            <div className={cn("export-page").elem("recent").toClassName()}>
              <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
                导出大型项目时遇到超时或问题？
              </a>
            </div>
            <div className={cn("export-page").elem("actions").toClassName()}>
              <Button className="w-[135px]" onClick={proceedExport} waiting={downloading} aria-label="导出数据">
                导出
              </Button>
            </div>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

const FormatInfo = ({ availableFormats, selected, onClick }) => {
  return (
    <div className={cn("formats").toClassName()}>
      <div className={cn("formats").elem("info").toClassName()}>
        你可以将数据集导出为以下格式之一：
      </div>
      <div className={cn("formats").elem("list").toClassName()}>
        {availableFormats.map((format) => (
          <div
            key={format.name}
            className={cn("formats")
              .elem("item")
              .mod({
                active: !format.disabled,
                selected: format.name === selected,
              })
              .toClassName()}
            onClick={!format.disabled ? () => onClick(format) : null}
          >
            <div className={cn("formats").elem("name").toClassName()}>
              {format.title}

              <Space size="small">
                {format.tags?.map?.((tag, index) => {
                  // Map tag text to badge variant
                  const tagLower = tag?.toLowerCase() || "";
                  let variant = "primary";
                  if (tagLower === "enterprise" || tagLower.includes("enterprise")) {
                    variant = "gradient";
                  } else if (tagLower === "beta") {
                    variant = "plum";
                  } else if (tagLower === "new" || tagLower.includes("new")) {
                    variant = "positive";
                  }

                  return (
                    <Badge key={index} variant={variant} size="small">
                      {tag}
                    </Badge>
                  );
                })}
              </Space>
            </div>

            {format.description && (
              <div className={cn("formats").elem("description").toClassName()}>{format.description}</div>
            )}
          </div>
        ))}
      </div>
      <div className={cn("formats").elem("feedback").toClassName()}>
        找不到导出格式？
        <br />
        请在
        <a className="no-go" href="https://slack.labelstud.io/?source=product-export" target="_blank" rel="noreferrer">
          Slack
        </a>
        中告诉我们，或向
        <a
          className="no-go"
          href="https://github.com/HumanSignal/label-studio-converter/issues"
          target="_blank"
          rel="noreferrer"
        >
          代码库
        </a>
        提交 issue
      </div>
    </div>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;

const ExportLargeProjectWarning = ({ taskCount }) => {
  if (!Number.isFinite(taskCount) || taskCount < LARGE_EXPORT_TASK_THRESHOLD) return null;

  return (
    <div className={cn("export-page").elem("warning").toClassName()}>
      <div className={cn("export-page").elem("warning-title").toClassName()}>
        检测到大型项目（{taskCount.toLocaleString()} 个任务）
      </div>
      <div className={cn("export-page").elem("warning-body").toClassName()}>
        为避免社区版中大型数据集导出时可能出现的超时，请使用
        <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
          CLI/SDK 导出选项
        </a>
        ，或考虑使用
        <a className="no-go" href={ENTERPRISE_URL} target="_blank" rel="noreferrer">
          企业版
        </a>
        进行大规模后台导出。
      </div>
    </div>
  );
};

const ExportTimeoutGuidance = ({ projectId, exportType }) => {
  const cliCommand = `label-studio export ${projectId} ${exportType} --export-path=<output-path>`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cliCommand]);

  return (
    <div className={cn("export-page").elem("timeout").toClassName()}>
      <div className={cn("export-page").elem("timeout-header").toClassName()}>
        <IconWarningCircleFilled className={cn("export-page").elem("timeout-icon").toClassName()} />
        <div className={cn("export-page").elem("timeout-title").toClassName()}>导出超时</div>
      </div>
      <div className={cn("export-page").elem("timeout-body").toClassName()}>
        此导出在社区版 UI 中同步处理，对于大型数据集可能会超过典型的反向代理超时时间（通常约 90 秒）。
      </div>

      <div className={cn("export-page").elem("timeout-actions").toClassName()}>
        <div className={cn("export-page").elem("timeout-actions-title").toClassName()}>推荐选项：</div>
        <ul className={cn("export-page").elem("timeout-actions-list").toClassName()}>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconTerminal className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                <span>
                  使用
                  <a className="no-go" href={EXPORT_CONSOLE_DOCS_URL} target="_blank" rel="noreferrer">
                    控制台命令
                    <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                  </a>
                  导出：
                </span>
                <div className={cn("export-page").elem("timeout-code-wrapper").toClassName()}>
                  <pre className={cn("export-page").elem("timeout-code").toClassName()}>
                    <code>{cliCommand}</code>
                  </pre>
                  <button
                    type="button"
                    className={cn("export-page").elem("timeout-copy-button").toClassName()}
                    onClick={handleCopy}
                    aria-label="复制命令"
                    title={copied ? "已复制！" : "复制命令"}
                  >
                    <IconCopyOutline className={cn("export-page").elem("timeout-copy-icon").toClassName()} />
                    {copied && (
                      <span className={cn("export-page").elem("timeout-copy-text").toClassName()}>已复制</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconCode className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                使用
                <a className="no-go" href={EXPORT_SNAPSHOT_SDK_URL} target="_blank" rel="noreferrer">
                  通过 SDK 导出快照
                  <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                </a>
                创建并下载快照，无需依赖单个 UI 请求。
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconWarningCircleFilled className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                对于 UI 中的大规模导出，考虑
                <a className="no-go" href={ENTERPRISE_URL} target="_blank" rel="noreferrer">
                  Label Studio 企业版
                  <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                </a>
                ，它专为大型项目和异步导出而设计。
              </div>
            </div>
          </li>
        </ul>
        <div className={cn("export-page").elem("timeout-footer").toClassName()}>
          <IconBook className={cn("export-page").elem("timeout-footer-icon").toClassName()} />
          <span>
            更多详情请参阅文档：
            <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
              社区版中的导出超时
              <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};
