import { getProviderConfig } from "../providers";
import { ProviderForm } from "../components/provider-form";
import Input from "apps/labelstudio/src/components/Form/Elements/Input/Input";
import { Toggle } from "@humansignal/ui";

interface ProviderDetailsStepProps {
  formData: any;
  errors: Record<string, string>;
  handleProviderFieldChange: (name: string, value: any) => void;
  handleFieldBlur?: (name: string, value: any) => void;
  provider?: string;
  isEditMode?: boolean;
  target?: "import" | "export";
}

export const ProviderDetailsStep = ({
  formData,
  errors,
  handleProviderFieldChange,
  handleFieldBlur,
  provider,
  isEditMode = false,
  target,
}: ProviderDetailsStepProps) => {
  const providerConfig = getProviderConfig(provider);

  if (!provider || !providerConfig) {
    return <div className="text-red-500">{!provider ? "未选择存储提供商" : `未知存储提供商：${provider}`}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{providerConfig.title}</h2>
        <p className="text-muted-foreground">{providerConfig.description}</p>
      </div>

      {/* Title field - common for all providers */}
      <div className="space-y-2">
        <Input
          name="title"
          value={formData.title ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProviderFieldChange("title", e.target.value)}
          placeholder="输入描述性名称（例如：'法律文档'、'训练数据'）"
          validate=""
          skip={false}
          labelProps={{}}
          ghost={false}
          tooltip=""
          tooltipIcon={null}
          required={true}
          label="存储标题"
          description="此名称将帮助你在项目中识别此连接"
          footer={errors.title ? <span className="text-negative-content">{errors.title}</span> : ""}
          className={errors.title ? "border-negative-content" : ""}
        />
      </div>

      <ProviderForm
        provider={providerConfig}
        formData={formData}
        errors={errors}
        onChange={handleProviderFieldChange}
        onBlur={handleFieldBlur}
        isEditMode={isEditMode}
        target={target}
      />

      {/* Export-specific common fields */}
      {target === "export" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Toggle
              checked={formData.can_delete_objects ?? false}
              onChange={(e) => handleProviderFieldChange("can_delete_objects", e.target.checked)}
              aria-label="可以从存储删除对象"
              label="可以从存储删除对象"
              description="如果未勾选，标注将不会从存储中删除"
            />
          </div>
        </div>
      )}
    </div>
  );
};
