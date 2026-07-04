import { SidebarMenu } from "../../components/SidebarMenu/SidebarMenu";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { WebhookPage } from "../WebhookPage/WebhookPage";
import { DangerZone } from "./DangerZone";
import { GeneralSettings } from "./GeneralSettings";
import { AnnotationSettings } from "./AnnotationSettings";
import { LabelingSettings } from "./LabelingSettings";
import { MachineLearningSettings } from "./MachineLearningSettings/MachineLearningSettings";
import { PredictionsSettings } from "./PredictionsSettings/PredictionsSettings";
import { StorageSettings } from "./StorageSettings/StorageSettings";
import "./settings.scss";

export const MenuLayout = ({ children, ...routeProps }) => {
  const { t } = useTranslation();

  const settingsMenuMap = {
    [GeneralSettings.menuItem ?? GeneralSettings.title]: t("settingsMenu.general"),
    [i18n.t("labelingSettings.labelingInterface")]: t("settingsMenu.labeling"),
    [i18n.t("annotationSettings.title")]: t("settingsMenu.annotation"),
    [i18n.t("mlSettings.title")]: t("settingsMenu.ml"),
    [i18n.t("predictionsSettings.title")]: t("settingsMenu.predictions"),
    [i18n.t("storageSettings.title")]: t("settingsMenu.storage"),
    [i18n.t("webhooks.title")]: t("settingsMenu.webhooks"),
    [i18n.t("dangerZone.title")]: t("settingsMenu.dangerZone"),
  };

  const menuItems = [
    GeneralSettings,
    LabelingSettings,
    AnnotationSettings,
    MachineLearningSettings,
    PredictionsSettings,
    StorageSettings,
    WebhookPage,
    DangerZone,
  ].filter(Boolean);

  const translatedMenuItems = menuItems.map((item) => ({
    ...item,
    menuItem: settingsMenuMap[item.title ?? item.menuItem] ?? item.title ?? item.menuItem,
    title: undefined,
  }));

  return (
    <SidebarMenu
      menuItems={translatedMenuItems}
      path={routeProps.match.url}
      children={children}
    />
  );
};

const pages = {
  AnnotationSettings,
  LabelingSettings,
  MachineLearningSettings,
  PredictionsSettings,
  StorageSettings,
  WebhookPage,
  DangerZone,
};

export const SettingsPage = {
  title: i18n.t("settings"),
  path: "/settings",
  exact: true,
  layout: MenuLayout,
  component: GeneralSettings,
  pages,
};
