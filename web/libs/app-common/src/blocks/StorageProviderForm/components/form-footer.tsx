import { Button, cnm } from "@humansignal/ui";

interface FormFooterProps {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSave?: () => void;
  isEditMode: boolean;
  connectionChecked: boolean;
  filesPreview: any[] | null;
  testConnection: {
    isLoading: boolean;
    mutate: () => void;
  };
  loadPreview: {
    isLoading: boolean;
    mutate: () => void;
  };
  createStorage: {
    isLoading: boolean;
  };
  saveStorage?: {
    isLoading: boolean;
  };
  target?: "import" | "export";
  isProviderDisabled?: boolean;
}

export const FormFooter = ({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSave,
  isEditMode,
  connectionChecked,
  filesPreview,
  testConnection,
  loadPreview,
  createStorage,
  saveStorage,
  target,
  isProviderDisabled = false,
}: FormFooterProps) => {
  return (
    <div className="flex items-center justify-between p-wide border-t border-neutral-border bg-neutral-background">
      <Button look="outlined" onClick={onPrevious} disabled={currentStep === 0}>
        上一步
      </Button>

      <div className="flex gap-tight items-center">
        {(isEditMode ? currentStep === 0 : currentStep === 1) && (
          <>
            <Button
              waiting={testConnection.isLoading}
              onClick={testConnection.mutate}
              variant={connectionChecked ? "positive" : "primary"}
              className={cnm({
                "border-none shadow-none bg-positive-surface-content-subtle text-positive-content pointer-events-none":
                  connectionChecked,
              })}
              style={connectionChecked ? { textShadow: "none" } : {}}
            >
              {connectionChecked ? "连接已验证" : "测试连接"}
            </Button>
          </>
        )}

        {(isEditMode ? currentStep === 1 : currentStep === 2) && (
          <Button waiting={loadPreview.isLoading} onClick={loadPreview.mutate} disabled={filesPreview !== null}>
            {filesPreview !== null ? "✓ 预览已加载" : "加载预览"}
          </Button>
        )}

        <Button
          onClick={onNext}
          waiting={currentStep === totalSteps - 1 && createStorage.isLoading}
          disabled={
            (!isEditMode && currentStep === 1 && !connectionChecked) || (currentStep === 0 && isProviderDisabled)
          }
          look={currentStep === totalSteps - 1 && target !== "export" ? "outlined" : undefined}
          tooltip={
            currentStep === 1 && !connectionChecked
              ? "继续前请先测试连接"
              : currentStep === 0 && isProviderDisabled
                ? "此提供商在当前版本中不可用"
                : undefined
          }
        >
          {currentStep < totalSteps - 1 ? "下一步" : target === "export" ? "保存" : "保存并同步"}
        </Button>

        {currentStep === totalSteps - 1 && target !== "export" && onSave && (
          <Button onClick={onSave} waiting={saveStorage?.isLoading}>
            保存
          </Button>
        )}
      </div>
    </div>
  );
};
