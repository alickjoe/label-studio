import { observer } from "mobx-react";
import { Button, Tooltip } from "@humansignal/ui";
import Utils from "../../utils";
import { cn } from "../../utils/bem";

import "./DraftPanel.prefix.css";

const panel = cn("draft-panel");

export const DraftPanel = observer(({ item }) => {
  if (!item.draftSaved && !item.versions.draft) return null;
  const saved = item.draft && item.draftSaved ? ` saved ${Utils.UDate.prettyDate(item.draftSaved)}` : "";

  if (!item.selected) {
    if (!item.draft) return null;
    return <div className={panel}>draft{saved}</div>;
  }
  if (!item.versions.result || !item.versions.result.length) {
    return <div className={panel}>{saved ? `draft${saved}` : "not submitted draft"}</div>;
  }
  return (
    <div className={panel}>
      <Tooltip
        alignment="top-left"
        title={item.draftSelected ? "切换到原始结果" : "切换到当前草稿"}
      >
        <Button
          type="button"
          size="smaller"
          look="string"
          onClick={() => item.toggleDraft()}
          className={panel.elem("toggle").toClassName()}
          aria-label="切换草稿模式"
        >
          {item.draftSelected ? "草稿" : "原始"}
        </Button>
      </Tooltip>
      {saved}
    </div>
  );
});
