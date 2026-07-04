import { formatDistanceToNow, format, parseISO } from "date-fns";
import { useCallback, useContext } from "react";

import truncate from "truncate-middle";
import { Menu } from "../../../components";
import { Button, Dropdown } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import { confirm } from "../../../components/Modal/Modal";
import { Oneof } from "../../../components/Oneof/Oneof";
import { IconEllipsis } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { ApiContext } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";

import "./MachineLearningList.scss";

export const MachineLearningList = ({ backends, fetchBackends, onEdit, onTestRequest, onStartTraining }) => {
  const api = useContext(ApiContext);

  const onDeleteModel = useCallback(
    async (backend) => {
      await api.callApi("deleteMLBackend", {
        params: {
          pk: backend.id,
        },
      });
      await fetchBackends();
    },
    [fetchBackends, api],
  );

  return (
    <div>
      {backends.map((backend) => (
        <BackendCard
          key={backend.id}
          backend={backend}
          onStartTrain={onStartTraining}
          onDelete={onDeleteModel}
          onEdit={onEdit}
          onTestRequest={onTestRequest}
        />
      ))}
    </div>
  );
};

const BackendCard = ({ backend, onStartTrain, onEdit, onDelete, onTestRequest }) => {
  const { t } = useTranslation();
  const confirmDelete = useCallback(
    (backend) => {
      confirm({
        title: t("mlSettings.deleteMLBackend"),
        body: t("mlSettings.deleteConfirm"),
        buttonLook: "destructive",
        onOk() {
          onDelete?.(backend);
        },
      });
    },
    [backend, onDelete],
  );

  const rootClass = cn("backend-card");

  return (
    <div className={rootClass.toClassName()}>
      <div className={rootClass.elem("title-container").toClassName()}>
        <div>
          <BackendState backend={backend} />
          <div className={rootClass.elem("title").toClassName()}>{backend.title}</div>
        </div>

        <div className={rootClass.elem("menu").toClassName()}>
          <Dropdown.Trigger
            align="right"
            content={
              <Menu size="medium" contextual>
                <Menu.Item onClick={() => onEdit(backend)}>{t("mlSettings.edit")}</Menu.Item>
                <Menu.Item onClick={() => onTestRequest(backend)}>{t("mlSettings.sendTestRequest")}</Menu.Item>
                <Menu.Item onClick={() => onStartTrain(backend)}>{t("mlSettings.startTrainingItem")}</Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => confirmDelete(backend)} isDangerous>
                  {t("mlSettings.delete")}
                </Menu.Item>
              </Menu>
            }
          >
            <Button look="string" size="small" className="!p-0" aria-label="Machine learning model options">
              <IconEllipsis />
            </Button>
          </Dropdown.Trigger>
        </div>
      </div>

      <div className={rootClass.elem("meta").toClassName()}>
        <div className={rootClass.elem("group").toClassName()}>{truncate(backend.url, 20, 10, "...")}</div>
        <div className={rootClass.elem("group").toClassName()}>
          <Tooltip title={format(parseISO(backend.created_at), "yyyy-MM-dd HH:mm:ss")}>
            <span>
              {t("mlSettings.created")}&nbsp;
              {formatDistanceToNow(parseISO(backend.created_at), {
                addSuffix: true,
              })}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

const BackendState = ({ backend }) => {
  const { state } = backend;
  const { t } = useTranslation();

  return (
    <div className={cn("ml").elem("status").toClassName()}>
      <span className={cn("ml").elem("indicator").mod({ state }).toClassName()} />
      <Oneof value={state} className={cn("ml").elem("status-label").toClassName()}>
        <span case="DI">{t("mlSettings.disconnected")}</span>
        <span case="CO">{t("mlSettings.connected")}</span>
        <span case="ER">{t("mlSettings.error")}</span>
        <span case="TR">{t("mlSettings.training")}</span>
        <span case="PR">{t("mlSettings.predicting")}</span>
      </Oneof>
    </div>
  );
};
