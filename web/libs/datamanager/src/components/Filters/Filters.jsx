import { inject } from "mobx-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/bem";
import { Button } from "@humansignal/ui";
import { FilterLine } from "./FilterLine/FilterLine";
import { IconChevronRight, IconPlus, IconCopyOutline, IconClipboardCheck, IconUndo } from "@humansignal/icons";
import { useRecentFilters } from "./useRecentFilters";
import "./Filters.scss";

const injector = inject(({ store }) => ({
  store,
  views: store.viewsStore,
  currentView: store.currentView,
  filters: store.currentView?.currentFilters ?? [],
  projectId: store.SDK?.projectId,
}));

export const Filters = injector(({ store, views, currentView, filters, projectId }) => {
  const { t } = useTranslation();
  const { sidebarEnabled } = views;
  const { fields, saveOnSwitch, saveInPlace } = useRecentFilters(projectId, currentView.availableFilters);
  const [copyFeedback, setCopyFeedback] = React.useState(false);
  const [pasteFeedback, setPasteFeedback] = React.useState(false);
  const [prePasteSnapshot, setPrePasteSnapshot] = React.useState(null);

  const handleCopyFilters = React.useCallback(async () => {
    try {
      const snapshot = currentView.allFiltersSnapshot;
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    } catch (e) {
      console.warn("Failed to copy filters:", e);
    }
  }, [currentView]);

  const showToast = React.useCallback(
    (message, type = "error") => {
      store?.SDK?.invoke?.("toast", { message, type });
    },
    [store],
  );

  const handlePasteFilters = React.useCallback(async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      showToast("Cannot read clipboard. Please allow clipboard access and try again.");
      return;
    }

    let snapshot;
    try {
      snapshot = JSON.parse(text);
    } catch {
      showToast("Clipboard does not contain valid JSON.");
      return;
    }

    if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.items)) {
      showToast('Invalid filter format. Expected { "conjunction": "and"|"or", "items": [...] }');
      return;
    }

    const beforePaste = currentView.allFiltersSnapshot;

    const result = currentView.importFilters(snapshot);
    if (result === false) {
      showToast("No matching filter columns found in this project. Filters may be from a different project.");
      return;
    }

    setPrePasteSnapshot(beforePaste);
    setPasteFeedback(true);
    setTimeout(() => setPasteFeedback(false), 1500);
  }, [currentView, showToast]);

  const handleUndoPaste = React.useCallback(() => {
    if (!prePasteSnapshot) return;
    currentView.importFilters(prePasteSnapshot);
    setPrePasteSnapshot(null);
  }, [currentView, prePasteSnapshot]);

  return (
    <div className={cn("filters").mod({ sidebar: sidebarEnabled }).toClassName()}>
      <div className={cn("filters").elem("list").mod({ withFilters: !!filters.length }).toClassName()}>
        {filters.length ? (
          filters.map((filter, i) => (
            <FilterLine
              index={i}
              filter={filter}
              view={currentView}
              sidebar={sidebarEnabled}
              value={filter.currentValue}
              key={`${filter.filter.id}-${i}`}
              availableFilters={fields}
              dropdownClassName={cn("filters").elem("selector").toClassName()}
              onSaveOnSwitch={saveOnSwitch}
              onSaveInPlace={saveInPlace}
            />
          ))
        ) : (
          <div className={cn("filters").elem("empty").toClassName()}>{t("filters.noFiltersApplied")}</div>
        )}
      </div>
      <div className={cn("filters").elem("actions").toClassName()}>
        <Button
          size="small"
          look="string"
          onClick={() => currentView.createFilter()}
          leading={<IconPlus className="!h-3 !w-3" />}
        >
          {filters.length ? t("filters.addAnotherFilter") : t("filters.addFilter")}
        </Button>

        <div className={cn("filters").elem("actions-right").toClassName()}>
          {filters.length > 0 && (
            <Button
              size="small"
              look="string"
              tooltip={copyFeedback ? t("filters.copied") : t("filters.copyFiltersTooltip")}
              onClick={handleCopyFilters}
              aria-label={t("filters.copyFilters")}
            >
              <IconCopyOutline className="!w-4 !h-4" />
            </Button>
          )}

          <Button
            size="small"
            look="string"
            tooltip={pasteFeedback ? t("filters.pasted") : t("filters.pasteFiltersTooltip")}
            onClick={handlePasteFilters}
            aria-label={t("filters.pasteFilters")}
          >
            <IconClipboardCheck className="!w-4 !h-4" />
          </Button>

          {prePasteSnapshot && (
            <Button
              size="small"
              look="string"
              tooltip={t("filters.undoPasteTooltip")}
              onClick={handleUndoPaste}
              aria-label={t("filters.undoPaste")}
            >
              <IconUndo className="!w-4 !h-4" />
            </Button>
          )}

          {!sidebarEnabled ? (
            <Button
              look="string"
              type="link"
              size="small"
              tooltip={t("filters.pinToSidebar")}
              onClick={() => views.expandFilters()}
              aria-label={t("filters.pinToSidebar")}
            >
              <IconChevronRight className="!w-4 !h-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
