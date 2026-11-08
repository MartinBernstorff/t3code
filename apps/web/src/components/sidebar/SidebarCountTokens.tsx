import {
  threadAgentState,
  type ThreadGroupInput,
} from "@t3tools/client-runtime/state/thread-grouping";
import type { SidebarTokenColor } from "@t3tools/contracts/settings";

import { cn } from "~/lib/utils";
import { useClientSettings } from "../../hooks/useSettings";

const TOKEN_LIMIT = 12;
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

export function SidebarCountNumber(props: { count: number }) {
  return <span className="font-normal tabular-nums">{props.count}</span>;
}

/** A section header's size, as a number or as tokens per the sidebar settings. */
export function SidebarSectionCount(props: { threads: readonly ThreadGroupInput[] }) {
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
  threads: readonly ThreadGroupInput[];
  color: SidebarTokenColor;
}) {
  const total = props.threads.length;
  if (total === 0) return null;
  const palette = props.color === "none" ? null : PALETTES[props.color];
  const bucketCounts = palette ? palette.classes.map(() => 0) : [total];
  if (palette) {
    for (const thread of props.threads) bucketCounts[palette.bucketOf(thread)]! += 1;
  }
  const tokens: { key: string; className: string }[] = [];
  bucketCounts.forEach((count, bucket) => {
    const className = palette ? palette.classes[bucket]! : NEUTRAL_TOKEN;
    for (let i = 0; i < count && tokens.length < TOKEN_LIMIT; i++) {
      tokens.push({ key: `${bucket}:${i}`, className });
    }
  });
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <span className="sr-only">{total}</span>
      {tokens.map((token) => (
        <span key={token.key} aria-hidden className={cn("size-1.5 rounded-xs", token.className)} />
      ))}
      {total > tokens.length ? (
        <span aria-hidden className="ms-0.5 font-normal tabular-nums">
          +{total - tokens.length}
        </span>
      ) : null}
    </span>
  );
}
