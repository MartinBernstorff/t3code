import { ThreadEngagement, ThreadPriority } from "@t3tools/contracts";
import type { SidebarGroupBy } from "@t3tools/contracts/settings";

import * as DateTime from "effect/DateTime";

import { type EnvironmentThreadShell, resolveThreadWorkingStartedAt } from "./models.ts";
import { isThreadWorking } from "./threadInbox.ts";

export type ThreadGroupDimension = SidebarGroupBy;

/** The sidebar sections a lane can hold; Snoozed and Settled stay as shelves outside lanes. */
const THREAD_GROUP_SECTIONS = ["pinned", "active", "working"] as const;
export type ThreadGroupSection = (typeof THREAD_GROUP_SECTIONS)[number];

type ThreadAgentStateInput = Pick<
  EnvironmentThreadShell,
  | "hasActionableProposedPlan"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "interactionMode"
  | "latestRun"
  | "runtime"
  | "waitingOnOthers"
>;

export interface ThreadGroupInput extends ThreadAgentStateInput {
  readonly environmentId: string;
  readonly projectId: string;
  readonly priority: ThreadPriority | null;
  readonly engagement: ThreadEngagement;
}

const THREAD_AGENT_STATES = ["needsYou", "working", "waitingOnOthers"] as const;
export type ThreadAgentState = (typeof THREAD_AGENT_STATES)[number];

/**
 * Requests from the agent or a guest need the user even mid-run; a turn holding for
 * background work counts as working. Anything else ended needs the user unless the
 * agent flagged that it is waiting on others.
 */
export function threadAgentState(thread: ThreadAgentStateInput): ThreadAgentState {
  const hasRequest =
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.pendingSubagentRequest != null ||
    (thread.pendingGuestMessageCount ?? 0) > 0;
  if (hasRequest) return "needsYou";
  if (isThreadWorking(thread)) return "working";
  return thread.waitingOnOthers ? "waitingOnOthers" : "needsYou";
}

export type ThreadAgentStateSinceInput = ThreadAgentStateInput & {
  readonly source?: Pick<EnvironmentThreadShell["source"], "pendingRuntimeRequest">;
};

/**
 * When the thread entered its `threadAgentState`, or null when no timestamp records it.
 * Waiting on others counts from the end of the turn, as the flag has no timestamp of its own.
 */
export function threadAgentStateSince(thread: ThreadAgentStateSinceInput): string | null {
  const state = threadAgentState(thread);
  if (state === "working") return resolveThreadWorkingStartedAt(thread);
  const request = thread.source?.pendingRuntimeRequest;
  if (state === "needsYou" && request != null) return DateTime.formatIso(request.createdAt);
  return thread.latestRun?.completedAt ?? null;
}

export interface ThreadGroupProject {
  readonly key: string;
  /** `${environmentId}:${projectId}` of each project folded into this group. */
  readonly memberProjectKeys: readonly string[];
}

export interface ThreadGroupContext {
  /** Project lanes in display order. */
  readonly projects: readonly ThreadGroupProject[];
  /** The sidebar decides sections from more than the thread (clock, drops, shelf setting). */
  readonly sectionOf: (thread: ThreadGroupInput) => ThreadGroupSection;
}

export interface ThreadLane<T> {
  /** Stable id for collapse state and React keys; see `threadLaneKey`. */
  readonly key: string;
  /** One `${dimension}:${value}` segment per grouping level, outermost first. */
  readonly path: readonly string[];
  readonly dimension: ThreadGroupDimension;
  readonly value: string;
  readonly threads: readonly T[];
}

const NO_PRIORITY_LANE = "none";

interface ThreadGroupDimensionDefinition {
  /** Lane values in display order. Other values get lanes after these, in first-seen order. */
  readonly values: (context: ThreadGroupContext) => readonly string[];
  readonly valueOf: (context: ThreadGroupContext) => (thread: ThreadGroupInput) => string;
  /** Listed lanes render even when empty, so they stay visible as drop targets. */
  readonly keepEmpty: boolean;
  /** Whether dropping a thread on this lane can set it; see `threadLaneDropChanges`. */
  readonly settable: (value: string) => boolean;
  /** Whether lanes below this level are inset. Section and Agent state read as flat headers. */
  readonly insetsNested: boolean;
}

const anySettable = () => true;
const noneSettable = () => false;

const projectRefKey = (thread: ThreadGroupInput) => `${thread.environmentId}:${thread.projectId}`;

const THREAD_GROUP_DIMENSIONS: Record<ThreadGroupDimension, ThreadGroupDimensionDefinition> = {
  section: {
    values: () => THREAD_GROUP_SECTIONS,
    valueOf: (context) => context.sectionOf,
    keepEmpty: false,
    settable: (value) => value === "pinned" || value === "active",
    insetsNested: false,
  },
  project: {
    values: (context) => context.projects.map((project) => project.key),
    valueOf: (context) => {
      const groupByMember = new Map<string, string>();
      for (const project of context.projects) {
        for (const member of project.memberProjectKeys) groupByMember.set(member, project.key);
      }
      return (thread) => groupByMember.get(projectRefKey(thread)) ?? projectRefKey(thread);
    },
    keepEmpty: false,
    settable: noneSettable,
    insetsNested: true,
  },
  priority: {
    values: () => [...ThreadPriority.literals, NO_PRIORITY_LANE],
    valueOf: () => (thread) => thread.priority ?? NO_PRIORITY_LANE,
    keepEmpty: false,
    settable: anySettable,
    insetsNested: true,
  },
  engagement: {
    values: () => ThreadEngagement.literals,
    valueOf: () => (thread) => thread.engagement,
    keepEmpty: true,
    settable: anySettable,
    insetsNested: true,
  },
  agentState: {
    values: () => THREAD_AGENT_STATES,
    valueOf: () => threadAgentState,
    keepEmpty: false,
    settable: noneSettable,
    insetsNested: false,
  },
};

/** The lanes a level lists, in display order, for naming lanes outside the sidebar. */
export function threadGroupLaneValues(
  dimension: ThreadGroupDimension,
  projectKeys: readonly string[],
): readonly string[] {
  return THREAD_GROUP_DIMENSIONS[dimension].values({
    projects: projectKeys.map((key) => ({ key, memberProjectKeys: [] })),
    sectionOf: () => "active",
  });
}

/**
 * Sets the Group by level at `index`, or clears it and the levels below with `null`.
 * Lower levels that now repeat a level above are dropped.
 */
export function withThreadGroupLevel(
  levels: readonly ThreadGroupDimension[],
  index: number,
  dimension: ThreadGroupDimension | null,
): ThreadGroupDimension[] {
  // The outermost level is required.
  if (dimension === null) return levels.slice(0, Math.max(index, 1));
  const above = levels.slice(0, index);
  const below = levels.slice(index + 1).filter((level) => level !== dimension);
  return [...above, dimension, ...below].filter((level, i, all) => all.indexOf(level) === i);
}

export function threadLaneKey(path: readonly string[]): string {
  return path.map(encodeURIComponent).join("/");
}

/**
 * Splits threads into lanes for one dimension, keeping input order inside each lane.
 * Nested grouping calls this again on a lane's threads with that lane's path as `parentPath`.
 */
export interface ThreadLaneOptions {
  /** Also lists empty lanes a drop can set, so a dragged thread can reach them. */
  readonly showEmptyDropTargets?: boolean;
}

export function groupThreadsBy<T extends ThreadGroupInput>(
  threads: readonly T[],
  dimension: ThreadGroupDimension,
  context: ThreadGroupContext,
  parentPath: readonly string[] = [],
  options: ThreadLaneOptions = {},
): ThreadLane<T>[] {
  const definition = THREAD_GROUP_DIMENSIONS[dimension];
  const valueOf = definition.valueOf(context);
  const byValue = new Map<string, T[]>(definition.values(context).map((value) => [value, []]));
  for (const thread of threads) {
    const value = valueOf(thread);
    const lane = byValue.get(value);
    if (lane === undefined) byValue.set(value, [thread]);
    else lane.push(thread);
  }
  const lanes: ThreadLane<T>[] = [];
  for (const [value, laneThreads] of byValue) {
    const keep =
      definition.keepEmpty || (options.showEmptyDropTargets === true && definition.settable(value));
    if (laneThreads.length === 0 && !keep) continue;
    const path = [...parentPath, `${dimension}:${value}`];
    lanes.push({ key: threadLaneKey(path), path, dimension, value, threads: laneThreads });
  }
  return lanes;
}

export type ThreadLaneRow<T> =
  | {
      readonly kind: "lane";
      readonly lane: ThreadLane<T>;
      /** 0 for the outermost level. Rows sit at the depth of the lane that lists them. */
      readonly depth: number;
      /** Left inset level: `depth` minus the flat levels above. Rows share their lane's inset. */
      readonly inset: number;
      readonly parentKey: string | null;
      readonly collapsed: boolean;
    }
  | {
      readonly kind: "thread";
      readonly thread: T;
      readonly depth: number;
      readonly inset: number;
      readonly laneKey: string;
    };

/**
 * Groups by each level in turn and flattens the lanes into header and thread rows.
 * A collapsed lane lists only the threads `keepWhenCollapsed` accepts (the open thread), with no nested lanes.
 */
export function threadLaneRows<T extends ThreadGroupInput>(
  threads: readonly T[],
  levels: readonly ThreadGroupDimension[],
  context: ThreadGroupContext,
  collapsed: {
    readonly keys: ReadonlySet<string>;
    readonly keepWhenCollapsed: (thread: T) => boolean;
  },
  options: ThreadLaneOptions & {
    /** Orders the threads a lane lists; lanes otherwise keep input order. */
    readonly orderLaneThreads?: (threads: readonly T[], lane: ThreadLane<T>) => readonly T[];
  } = {},
): ThreadLaneRow<T>[] {
  const rows: ThreadLaneRow<T>[] = [];
  const visit = (
    laneThreads: readonly T[],
    depth: number,
    inset: number,
    parent: ThreadLane<T> | null,
  ) => {
    const dimension = levels[depth];
    if (dimension === undefined) return;
    const nestedInset = THREAD_GROUP_DIMENSIONS[dimension].insetsNested ? inset + 1 : inset;
    for (const lane of groupThreadsBy(laneThreads, dimension, context, parent?.path, options)) {
      const isCollapsed = collapsed.keys.has(lane.key);
      rows.push({
        kind: "lane",
        lane,
        depth,
        inset,
        parentKey: parent?.key ?? null,
        collapsed: isCollapsed,
      });
      if (!isCollapsed && depth + 1 < levels.length) {
        visit(lane.threads, depth + 1, nestedInset, lane);
        continue;
      }
      const listed = options.orderLaneThreads?.(lane.threads, lane) ?? lane.threads;
      for (const thread of listed) {
        if (isCollapsed && !collapsed.keepWhenCollapsed(thread)) continue;
        rows.push({ kind: "thread", thread, depth, inset, laneKey: lane.key });
      }
    }
  };
  visit(threads, 0, 0, null);
  return rows;
}

export type ThreadLaneDropChange =
  | { readonly kind: "priority"; readonly priority: ThreadPriority | null }
  | { readonly kind: "engagement"; readonly engagement: ThreadEngagement }
  | { readonly kind: "pin" }
  | { readonly kind: "unpin" }
  | { readonly kind: "unsettle" }
  | { readonly kind: "unsnooze" };

export interface ThreadLaneDropInput {
  readonly priority: ThreadPriority | null;
  readonly engagement: ThreadEngagement;
  readonly pinned: boolean;
  /** The thread's sidebar placement, including the Snoozed and Settled shelves. */
  readonly section: ThreadGroupSection | "snoozed" | "settled";
  /** Which changes the thread's server can decode. */
  readonly supports: Readonly<Record<ThreadLaneDropChange["kind"], boolean>>;
}

/**
 * The changes that move a thread into the lane at `path`, one per settable level.
 * Project, Agent state and the Working section are not settable and are skipped.
 * An empty result means the header is not a drop target for this thread, including when
 * the thread's server lacks a command the drop needs.
 */
export function threadLaneDropChanges(
  path: readonly string[],
  thread: ThreadLaneDropInput,
): ThreadLaneDropChange[] {
  let priority: ThreadPriority | null | undefined;
  let engagement: ThreadEngagement | undefined;
  let section: string | undefined;
  for (const segment of path) {
    const separator = segment.indexOf(":");
    const value = segment.slice(separator + 1);
    switch (segment.slice(0, separator)) {
      case "priority":
        priority =
          value === NO_PRIORITY_LANE ? null : ThreadPriority.literals.find((p) => p === value);
        break;
      case "engagement":
        engagement = ThreadEngagement.literals.find((e) => e === value);
        break;
      case "section":
        section = value;
        break;
    }
  }
  const changes: ThreadLaneDropChange[] = [];
  let engagementAfter = thread.engagement;
  if (priority !== undefined && priority !== thread.priority) {
    changes.push({ kind: "priority", priority });
    // UI priority changes engage the thread (see `setThreadPriority`).
    if (priority !== null) engagementAfter = "engaged";
  }
  if (engagement !== undefined && engagement !== engagementAfter) {
    changes.push({ kind: "engagement", engagement });
  }
  if (section === "pinned" && !thread.pinned) changes.push({ kind: "pin" });
  if (section === "active" && thread.pinned) changes.push({ kind: "unpin" });
  const targetsSettableLane =
    priority !== undefined ||
    engagement !== undefined ||
    section === "pinned" ||
    section === "active";
  // Otherwise the thread would stay on its shelf instead of moving into the lane.
  if (targetsSettableLane && thread.section === "settled") changes.push({ kind: "unsettle" });
  if (targetsSettableLane && thread.section === "snoozed") changes.push({ kind: "unsnooze" });
  return changes.every((change) => thread.supports[change.kind]) ? changes : [];
}
