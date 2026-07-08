import { buttonVariant, Space } from "@humansignal/ui";
import { useUpdatePageTitle } from "@humansignal/core";
import { cn } from "apps/labelstudio/src/utils/bem";
import { Link } from "react-router-dom";
import type { Page } from "../../types/Page";
import { EmptyList } from "./@components/EmptyList";

export const ModelsPage: Page = () => {
  useUpdatePageTitle("模型");

  return (
    <div className={cn("prompter").toClassName()}>
      <EmptyList />
    </div>
  );
};

ModelsPage.title = () => "模型";
ModelsPage.titleRaw = "模型";
ModelsPage.path = "/models";

ModelsPage.context = () => {
  return (
    <Space size="small">
      <Link to="/prompt/settings" className={buttonVariant({ size: "small" })}>
        创建模型
      </Link>
    </Space>
  );
};
