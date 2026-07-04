import { Button } from "@humansignal/ui";
import { modal } from "../../components/Modal/Modal";
import { useModalControls } from "../../components/Modal/ModalPopup";
import { Space } from "../../components/Space/Space";
import { cn } from "../../utils/bem";

export const WebhookDeleteModal = ({ onDelete, t }) => {
  const DeleteModalBody = () => {
    const rootClass = cn("webhook-delete-modal");
    return (
      <div className={rootClass}>
        <div className={rootClass.elem("modal-text").toClassName()}>
          {t("webhooks.deleteConfirmBody")}
        </div>
      </div>
    );
  };

  const DeleteModalFooter = () => {
    const ctrl = useModalControls();
    const rootClass = cn("webhook-delete-modal");
    return (
      <Space align="end">
        <Button
          look="outlined"
          onClick={() => {
            ctrl.hide();
          }}
          aria-label={t("webhooks.cancel")}
        >
          {t("webhooks.cancel")}
        </Button>
        <Button
          variant="negative"
          onClick={async () => {
            await onDelete();
            ctrl.hide();
          }}
          aria-label={t("webhooks.deleteWebhook")}
        >
          {t("webhooks.deleteWebhook")}
        </Button>
      </Space>
    );
  };

  return modal({
    title: t("webhooks.deleteTitle"),
    body: () => <DeleteModalBody />,
    footer: () => <DeleteModalFooter />,
    style: { width: 512 },
  });
};
