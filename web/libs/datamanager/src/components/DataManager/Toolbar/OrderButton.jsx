import { IconSortDown, IconSortUp } from "@humansignal/icons";
import { Button, ButtonGroup, EnterpriseBadge } from "@humansignal/ui";
import { inject } from "mobx-react";
import { useTranslation } from "react-i18next";
import { FieldsButton } from "../../Common/FieldsButton";
import { Space } from "../../Common/Space/Space";

const injector = inject(({ store }) => {
  const view = store?.currentView;

  return {
    view,
    ordering: view?.currentOrder,
  };
});

export const OrderButton = injector(({ size, ordering, view, ...rest }) => {
  const { t } = useTranslation();
  return (
    <Space style={{ fontSize: 12 }}>
      <ButtonGroup collapsed {...rest}>
        <FieldsButton
          size={size}
          style={{ minWidth: 67, textAlign: "left", marginRight: -1 }}
          title={ordering ? ordering.column?.title : t("dataManager.orderBy")}
          onClick={(col) => view.setOrdering(col.id)}
          onReset={() => view.setOrdering(null)}
          resetTitle={t("dataManager.default")}
          selected={ordering?.field}
          filter={(col) => {
            return col.orderable ?? col.original?.orderable;
          }}
          wrapper={({ column, children, enterpriseBadge }) => (
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              {children}

              <div className="flex items-center gap-tight">
                {enterpriseBadge && <EnterpriseBadge style="ghost" />}
                {column?.icon && <div className="w-6 h-6 flex items-center justify-center">{column.icon}</div>}
              </div>
            </Space>
          )}
          openUpwardForShortViewport={false}
        />

        <Button
          size={size}
          look="outlined"
          variant="neutral"
          disabled={!!ordering === false}
          onClick={() => view.setOrdering(ordering?.field)}
          aria-label={ordering?.desc ? t("dataManager.sortAscending") : t("dataManager.sortDescending")}
        >
          {ordering?.desc ? <IconSortUp /> : <IconSortDown />}
        </Button>
      </ButtonGroup>
    </Space>
  );
});
