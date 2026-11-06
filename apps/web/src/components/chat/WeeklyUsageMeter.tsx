import type { ServerProviderUsageWindow, UsageLimitsReport } from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { LimitWindows } from "../usage/UsageLimits";
import { composerFloatingLayerProps } from "./composerEventScope";

export interface WeeklyUsage {
  readonly account: UsageLimitsReport["accounts"][number];
  readonly window: ServerProviderUsageWindow;
}

export function WeeklyUsageMeter({ usage }: { readonly usage: WeeklyUsage }) {
  const usedPercent = Math.round(Math.max(0, Math.min(100, usage.window.usedPercent)));
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <Button
            size="xs"
            variant="ghost-muted"
            className="shrink-0"
            aria-label={`Weekly usage ${usedPercent}% used`}
          >
            <span className={usedPercent >= 90 ? "text-destructive tabular-nums" : "tabular-nums"}>
              W {usedPercent}%
            </span>
          </Button>
        }
      />
      <PopoverPopup
        {...composerFloatingLayerProps}
        tooltipStyle
        side="top"
        align="end"
        padding="none"
        className="text-left whitespace-normal"
      >
        <WeeklyUsageDetails account={usage.account} />
      </PopoverPopup>
    </Popover>
  );
}

function WeeklyUsageDetails({ account }: { readonly account: WeeklyUsage["account"] }) {
  // The popup mounts on open, so reset countdowns are measured from that moment.
  const [now] = useState(() => Date.now());
  return (
    <div className="flex flex-col gap-2 p-(--floating-content-inset)">
      <div className="font-medium text-muted-foreground text-xs">Usage limits</div>
      <LimitWindows
        compact
        driver={account.driver}
        accentColor={account.accentColor}
        windows={account.limits.windows}
        now={now}
      />
    </div>
  );
}
