import { IconChevronDown } from "@humansignal/icons";
import { isStarterCloudPlan } from "@humansignal/core";
import { useTranslation } from "react-i18next";
import { cn } from "../../../utils/bem";
import { ErrorBox } from "../../Common/ErrorBox";
import { FieldsButton } from "../../Common/FieldsButton";
import { FiltersPane } from "../../Common/FiltersPane";
import { Icon } from "../../Common/Icon/Icon";
import { Interface } from "../../Common/Interface";
import { ExportButton, ImportButton } from "../../Common/SDKButtons";
import { Tooltip } from "@humansignal/ui";
import { ActionsButton } from "./ActionsButton";
import { DensityToggle } from "./DensityToggle";
import { GridWidthButton } from "./GridWidthButton";
import { LabelButton } from "./LabelButton";
import { LoadingPossum } from "./LoadingPossum";
import { OrderButton } from "./OrderButton";
import { RefreshButton } from "./RefreshButton";
import { ViewToggle } from "./ViewToggle";

const style = {
  minWidth: "80px",
  justifyContent: "space-between",
};

/**
 * Checks for Starter Cloud trial expiration.
 * If expired it renders disabled Import button with a tooltip.
 */
const ColumnsButton = ({ size }) => {
  const { t } = useTranslation();
  const iconProps = {
    style: {
      marginRight: 4,
    },
    icon: IconChevronDown,
  };
  return (
    <FieldsButton
      wrapper={FieldsButton.Checkbox}
      trailingIcon={<Icon {...iconProps} />}
      title={t("dataManager.columns")}
      size={size}
      style={style}
      openUpwardForShortViewport={false}
    />
  );
};

const ExportButtonWrapper = ({ size }) => {
  const { t } = useTranslation();
  return (
    <Interface name="export">
      <ExportButton size={size}>{t("dataManager.export")}</ExportButton>
    </Interface>
  );
};

const ImportButtonWithChecks = ({ size }) => {
  const { t } = useTranslation();
  const simpleButton = <ImportButton size={size}>{t("dataManager.import")}</ImportButton>;
  const isOpenSource = !window.APP_SETTINGS.billing;
  // Check if user is on Starter Cloud plan
  const isStarterCloud = isStarterCloudPlan();

  if (isOpenSource || !isStarterCloud) return simpleButton;

  // Check if user is on trial
  const isTrialExpired = window.APP_SETTINGS.billing.checks?.is_license_expired;
  // Check the subscription period end date
  const subscriptionPeriodEnd = window.APP_SETTINGS.subscription?.current_period_end;
  // Check if user is on Starter Cloud and has expired trial
  const isStarterCloudExpiredTrial = isStarterCloud && isTrialExpired && !subscriptionPeriodEnd;
  // Check if user is on Starter Cloud and has expired subscription
  const isStarterCloudExpiredSubscription =
    isStarterCloud && subscriptionPeriodEnd && new Date(subscriptionPeriodEnd) < new Date();
  // Check if user is on Starter Cloud and has expired trial or subscription
  const isStarterCloudExpired = isStarterCloudExpiredTrial || isStarterCloudExpiredSubscription;

  if (!isStarterCloudExpired) return simpleButton;

  // Disabled buttons ignore hover, so we use wrapper to properly handle a tooltip
  return (
    <Tooltip
      title={t("dataManager.upgradePlan")}
      style={{
        maxWidth: 200,
        textAlign: "center",
      }}
    >
      <div className={cn("button-wrapper").toClassName()}>
        <ImportButton disabled size={size}>
          {t("dataManager.import")}
        </ImportButton>
      </div>
    </Tooltip>
  );
};

export const instruments = {
  "view-toggle": ({ size }) => {
    return <ViewToggle size={size} style={style} />;
  },
  "density-toggle": ({ size }) => {
    return <DensityToggle size={size} />;
  },
  columns: ({ size }) => {
    return <ColumnsButton size={size} />;
  },
  filters: ({ size }) => {
    return <FiltersPane size={size} style={style} />;
  },
  ordering: ({ size }) => {
    return <OrderButton size={size} style={style} />;
  },
  "grid-size": ({ size }) => {
    return <GridWidthButton size={size} />;
  },
  refresh: ({ size }) => {
    return <RefreshButton size={size} />;
  },
  "loading-possum": () => {
    return <LoadingPossum />;
  },
  "label-button": ({ size }) => {
    return <LabelButton size={size} />;
  },
  actions: ({ size }) => {
    return <ActionsButton size={size} style={style} />;
  },
  "error-box": () => {
    return <ErrorBox />;
  },
  "import-button": ({ size }) => {
    return (
      <Interface name="import">
        <ImportButtonWithChecks size={size} />
      </Interface>
    );
  },
  "export-button": ({ size }) => {
    return <ExportButtonWrapper size={size} />;
  },
};
