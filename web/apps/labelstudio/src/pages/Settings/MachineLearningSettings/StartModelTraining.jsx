import { useCallback, useState } from "react";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../../providers/ApiProvider";
import { Typography } from "@humansignal/ui";

export const StartModelTraining = ({ backend }) => {
  const api = useAPI();
  const [response, setResponse] = useState(null);

  const onStartTraining = useCallback(
    async (backend) => {
      const res = await api.callApi("trainMLBackend", {
        params: {
          pk: backend.id,
        },
      });

      setResponse(res.response || {});
    },
    [api],
  );

  return (
    <div className="max-w-[680px]">
      <Typography size="small" className="text-neutral-content-subtler">
        你即将手动触发模型的训练过程。此操作将根据 ML 后端中 train 方法的实现启动学习阶段。继续以开始此过程。
      </Typography>
      <Typography size="small" className="text-neutral-content-subtler mt-base mb-wide">
        *注意：目前界面中没有内置的反馈循环来跟踪训练进度。你需要通过模型自带的工具和环境直接监控模型的训练步骤。
      </Typography>

      {!response && (
        <Button
          onClick={() => {
            onStartTraining(backend);
          }}
        >
          开始训练
        </Button>
      )}

      {!!response && (
        <>
          <pre>请求已发送！</pre>
          <pre>响应：{JSON.stringify(response, null, 2)}</pre>
        </>
      )}
    </div>
  );
};
