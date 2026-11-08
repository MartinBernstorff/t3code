import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { ServerProviderUsageWindow, UsageLimitsReport } from "@t3tools/contracts";
import { Minimize2Icon } from "lucide-react";
import { useState } from "react";

import { formatContextWindowTokens } from "~/lib/contextWindow";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { LimitWindows } from "../usage/UsageLimits";
import { composerFloatingLayerProps } from "./composerEventScope";
import {
  formatContextWindowCompactionMessage,
  formatContextWindowCost,
  resolveContextWindowMeterScale,
  type ContextWindowMeterTone,
} from "./ContextWindowMeter.logic";

export interface WeeklyUsage {
  readonly account: UsageLimitsReport["accounts"][number];
  readonly window: ServerProviderUsageWindow;
}

const NEUTRAL_COLOR = "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";

const CONTEXT_TONE_COLOR: Record<ContextWindowMeterTone, string> = {
  neutral: NEUTRAL_COLOR,
  warning: "var(--color-warning)",
  critical: "var(--color-orange-500)",
};

const WEEKLY_CRITICAL_PERCENT = 90;

function MicroBar({ percent, color }: { readonly percent: number; readonly color: string }) {
  return (
    <span className="block h-0.75 w-5 overflow-hidden rounded-full bg-muted-foreground/24">
      <span
        className="block h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </span>
  );
}

export function ComposerUsageMeter(props: {
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly capTokens: number;
  readonly weeklyUsage: WeeklyUsage | null;
  readonly modelDisplayName: string | null;
  readonly onCompact?: (() => void) | undefined;
  readonly compactDisabled: boolean;
  readonly compactDisabledReason: string | null;
}) {
  const { contextWindow, weeklyUsage } = props;
  const contextScale = contextWindow
    ? resolveContextWindowMeterScale({
        usedTokens: contextWindow.usedTokens,
        maxTokens: contextWindow.maxTokens ?? null,
        capTokens: props.capTokens,
      })
    : null;
  const contextLabel = contextWindow
    ? formatContextTokens(contextWindow.usedTokens, contextWindow.maxTokens ?? null)
    : null;
  const weeklyPercent = weeklyUsage
    ? Math.round(Math.max(0, Math.min(100, weeklyUsage.window.usedPercent)))
    : null;
  const ariaLabel = [
    contextLabel ? `Context ${contextLabel} tokens` : null,
    weeklyPercent !== null ? `Weekly usage ${weeklyPercent}% used` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={props.onCompact ? 150 : 0}
        render={
          <Button
            size="icon-sm"
            variant="ghost-muted"
            className="size-7 shrink-0"
            aria-label={ariaLabel}
          >
            <span className="flex flex-col gap-0.75">
              {contextScale ? (
                <MicroBar
                  percent={contextScale.usedPercentage}
                  color={CONTEXT_TONE_COLOR[contextScale.tone]}
                />
              ) : null}
              {weeklyPercent !== null ? (
                <MicroBar
                  percent={weeklyPercent}
                  color={
                    weeklyPercent >= WEEKLY_CRITICAL_PERCENT
                      ? "var(--color-destructive)"
                      : NEUTRAL_COLOR
                  }
                />
              ) : null}
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
        <div className="flex flex-col gap-3 p-(--floating-content-inset)">
          {contextWindow && contextLabel ? (
            <ContextDetails
              usage={contextWindow}
              label={contextLabel}
              modelDisplayName={props.modelDisplayName}
              onCompact={props.onCompact}
              compactDisabled={props.compactDisabled}
              compactDisabledReason={props.compactDisabledReason}
            />
          ) : null}
          {weeklyUsage ? <WeeklyDetails account={weeklyUsage.account} /> : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

export function ComposerUsageMeterPlaceholder() {
  return <span aria-hidden="true" className="size-7 shrink-0" />;
}

function formatContextTokens(usedTokens: number, maxTokens: number | null): string {
  const used = formatContextWindowTokens(usedTokens);
  return maxTokens !== null && maxTokens > 0
    ? `${used}/${formatContextWindowTokens(maxTokens)}`
    : used;
}

function ContextDetails(props: {
  readonly usage: ContextWindowSnapshot;
  readonly label: string;
  readonly modelDisplayName: string | null;
  readonly onCompact?: (() => void) | undefined;
  readonly compactDisabled: boolean;
  readonly compactDisabledReason: string | null;
}) {
  const { usage } = props;
  const totalProcessedTokens = usage.totalProcessedTokens ?? null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-muted-foreground text-xs">Context</div>
        <div className="text-secondary-label text-2xs tabular-nums">{props.label}</div>
      </div>
      {totalProcessedTokens !== null && totalProcessedTokens > 0 ? (
        <div className="flex items-center justify-between gap-3 text-2xs leading-4">
          <span className="text-secondary-label">Total processed</span>
          <span className="font-medium tabular-nums text-secondary-label">
            {formatContextWindowTokens(totalProcessedTokens)}
          </span>
        </div>
      ) : null}
      {usage.cost != null ? (
        <div className="flex items-center justify-between gap-3 text-2xs leading-4">
          <span className="text-secondary-label">Cost</span>
          <span className="font-medium tabular-nums text-secondary-label">
            {formatContextWindowCost(usage.cost)}
          </span>
        </div>
      ) : null}
      {usage.compactsAutomatically ? (
        <div className="mt-1 text-pretty text-secondary-label text-2xs font-medium">
          {formatContextWindowCompactionMessage(props.modelDisplayName, usage.autoCompactThreshold)}
        </div>
      ) : null}
      {props.onCompact ? (
        <>
          <Button
            size="xs"
            variant="outline"
            className="mt-1 w-full justify-center"
            disabled={props.compactDisabled}
            onClick={props.onCompact}
          >
            <Minimize2Icon aria-hidden="true" />
            Compact context
          </Button>
          {props.compactDisabled && props.compactDisabledReason ? (
            <div className="text-pretty text-secondary-label text-2xs">
              {props.compactDisabledReason}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function WeeklyDetails({ account }: { readonly account: WeeklyUsage["account"] }) {
  // The popup mounts on open, so reset countdowns are measured from that moment.
  const [now] = useState(() => Date.now());
  return (
    <div className="flex flex-col gap-2">
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
