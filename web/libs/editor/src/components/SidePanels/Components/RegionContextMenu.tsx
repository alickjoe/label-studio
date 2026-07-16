import { useCopyText } from "@humansignal/core";
import { IconEllipsis, IconLink } from "@humansignal/icons";
import { Button, ToastType, useToast } from "@humansignal/ui";
import { observer } from "mobx-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { cn } from "../../../utils/bem";
import { ContextMenu, type ContextMenuAction, ContextMenuTrigger, type MenuActionOnClick } from "../../ContextMenu";

export const RegionContextMenu: FC<{ item: any }> = observer(({ item }: { item: any }) => {
  const [open, setOpen] = useState(false);
  const regionLink = useMemo(() => {
    const url = new URL(window.location.href);
    if (item.annotation.pk) {
      url.searchParams.set("annotation", item.annotation.pk);
    }
    if (item.id) {
      url.searchParams.set("region", item.id.split("#")[0]);
    }
    return url.toString();
  }, [item]);
  const [copyLink] = useCopyText({ defaultText: regionLink });
  const toast = useToast();

  const onCopyLink = useCallback<MenuActionOnClick>(
    (_, ctx) => {
      copyLink();
      ctx.dropdown?.close();
      toast.show({
        message: "区域链接已复制到剪贴板",
        type: ToastType.info,
      });
    },
    [copyLink],
  );

  const actions = useMemo<ContextMenuAction[]>(
    () => [
      {
        label: "复制区域链接",
        onClick: onCopyLink,
        icon: <IconLink />,
      },
    ],
    [onCopyLink],
  );

  return (
    <ContextMenuTrigger
      className={cn("region-context-menu").mod({ open }).toClassName()}
      content={<ContextMenu actions={actions} />}
      onToggle={(isOpen) => setOpen(isOpen)}
    >
      <Button variant="neutral" look="string" size="smaller" aria-label="区域选项">
        <IconEllipsis />
      </Button>
    </ContextMenuTrigger>
  );
});
