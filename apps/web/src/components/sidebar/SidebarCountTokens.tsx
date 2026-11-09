import {
  threadAgentState,
  threadAgentStateSince,
  type ThreadAgentStateSinceInput,
  type ThreadGroupInput,
} from "@t3tools/client-runtime/state/thread-grouping";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { SidebarTokenColor } from "@t3tools/contracts/settings";
import { Link } from "@tanstack/react-router";

import { cn } from "~/lib/utils";
import { useNowSecond } from "../../hooks/useNowSecond";
import { useClientSettings } from "../../hooks/useSettings";
import { buildThreadRouteParams } from "../../threadRoutes";
import { formatElapsedDurationLabel } from "../../timestampFormat";
import { sidebarLaneLabel } from "../Sidebar.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const TOKEN_LIMIT = 12;
const TOOLTIP_TITLE_LIMIT = 20;
const NEUTRAL_TOKEN = "bg-sidebar-muted-foreground/50";

interface TokenPalette {
  /** Token classes in display order; threads sort into these buckets. */
  readonly classes: readonly string[];
  readonly bucketOf: (thread: ThreadGroupInput) => number;
}

const AGENT_STATE_ORDER = ["needsYou", "working", "waitingOnOthers"] as const;
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const ENGAGEMENT_ORDER = ["engaged", "inbox", "queued"] as const;

const PALETTES: Record<Exclude<SidebarTokenColor, "none">, TokenPalette> = {
  agentState: {
    classes: ["bg-warning", "bg-info", NEUTRAL_TOKEN],
    bucketOf: (thread) => AGENT_STATE_ORDER.indexOf(threadAgentState(thread)),
  },
  priority: {
    classes: ["bg-error", "bg-warning", "bg-info", NEUTRAL_TOKEN, "bg-sidebar-muted-foreground/25"],
    bucketOf: (thread) =>
      thread.priority === null ? PRIORITY_ORDER.length : PRIORITY_ORDER.indexOf(thread.priority),
  },
  engagement: {
    classes: ["bg-success", "bg-info", NEUTRAL_TOKEN],
    bucketOf: (thread) => ENGAGEMENT_ORDER.indexOf(thread.engagement),
  },
};

/** The colour of a thread's token under the sidebar's token colour setting. */
export function sidebarTokenClassName(thread: ThreadGroupInput, color: SidebarTokenColor): string {
  if (color === "none") return NEUTRAL_TOKEN;
  const palette = PALETTES[color];
  return palette.classes[palette.bucketOf(thread)]!;
}

export function SidebarCountNumber(props: { count: number }) {
  return <span className="font-normal tabular-nums">{props.count}</span>;
}

type CountedThread = ThreadGroupInput &
  ThreadAgentStateSinceInput & {
    readonly environmentId: EnvironmentId;
    readonly id: ThreadId;
    readonly title: string;
  };

/** A section header's size, as a number or as tokens per the sidebar settings. */
export function SidebarSectionCount(props: { threads: readonly CountedThread[] }) {
  const style = useClientSettings((s) => s.sidebarSectionCountStyle);
  const color = useClientSettings((s) => s.sidebarTokenColor);
  return style === "number" ? (
    <SidebarCountNumber count={props.threads.length} />
  ) : (
    <SidebarCountTokens threads={props.threads} color={color} />
  );
}

/** One small square per thread, grouped by colour, in place of a section's count. */
function SidebarCountTokens(props: {
  threads: readonly CountedThread[];
  color: SidebarTokenColor;
}) {
  const total = props.threads.length;
  if (total === 0) return null;
  const palette = props.color === "none" ? null : PALETTES[props.color];
  const buckets: CountedThread[][] = palette ? palette.classes.map(() => []) : [[]];
  for (const thread of props.threads) {
    buckets[palette ? palette.bucketOf(thread) : 0]!.push(thread);
  }
  const tokens: { key: string; className: string }[] = [];
  const titles: { key: string; className: string; thread: CountedThread }[] = [];
  buckets.forEach((threads, bucket) => {
    const className = palette ? palette.classes[bucket]! : NEUTRAL_TOKEN;
    for (const thread of threads) {
      if (tokens.length < TOKEN_LIMIT)
        tokens.push({ key: `${bucket}:${tokens.length}`, className });
      if (titles.length < TOOLTIP_TITLE_LIMIT) {
        titles.push({
          key: `${thread.environmentId}:${thread.id}`,
          className,
          thread,
        });
      }
    }
  });
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0 items-center gap-0.5" />}>
        <span className="sr-only">{total}</span>
        {tokens.map((token) => (
          <span
            key={token.key}
            aria-hidden
            className={cn("size-1.5 rounded-xs", token.className)}
          />
        ))}
        {total > tokens.length ? (
          <span aria-hidden className="ms-0.5 font-normal tabular-nums">
            +{total - tokens.length}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="right" align="start" className="pointer-events-auto">
        <TokenThreadList entries={titles} hiddenCount={total - titles.length} />
      </TooltipPopup>
    </Tooltip>
  );
}

function TokenThreadList(props: {
  entries: readonly { key: string; className: string; thread: CountedThread }[];
  hiddenCount: number;
}) {
  return (
    <ul className="flex max-w-72 flex-col gap-0.5">
      {props.entries.map((entry) => (
        <li key={entry.key} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-xs", entry.className)} />
          <Link
            to="/$environmentId/$threadId"
            params={buildThreadRouteParams(
              scopeThreadRef(entry.thread.environmentId, entry.thread.id),
            )}
            className="truncate hover:underline"
          >
            {entry.thread.title}
          </Link>
          <ThreadAgentStateDuration thread={entry.thread} />
        </li>
      ))}
      {props.hiddenCount > 0 ? (
        <li className="text-muted-foreground">+{props.hiddenCount} more</li>
      ) : null}
    </ul>
  );
}

// Mounted only while the tooltip is open, so the per-second tick costs nothing otherwise.
function ThreadAgentStateDuration(props: { thread: ThreadAgentStateSinceInput }) {
  const nowMs = useNowSecond();
  const label = sidebarLaneLabel(
    { dimension: "agentState", value: threadAgentState(props.thread) },
    [],
  );
  const since = threadAgentStateSince(props.thread);
  return (
    <span className="ms-auto shrink-0 ps-2 text-muted-foreground tabular-nums">
      {label}
      {since === null ? null : ` ${formatElapsedDurationLabel(since, nowMs)}`}
    </span>
  );
}
