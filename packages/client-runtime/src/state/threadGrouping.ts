import { ThreadEngagement, ThreadPriority } from "@t3tools/contracts";
import type { SidebarGroupBy } from "@t3tools/contracts/settings";

import type { EnvironmentThreadShell } from "./models.ts";
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
}

const projectRefKey = (thread: ThreadGroupInput) => `${thread.environmentId}:${thread.projectId}`;

const THREAD_GROUP_DIMENSIONS: Record<ThreadGroupDimension, ThreadGroupDimensionDefinition> = {
  section: {
    values: () => THREAD_GROUP_SECTIONS,
    valueOf: (context) => context.sectionOf,
    keepEmpty: false,
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
  },
  priority: {
    values: () => [...ThreadPriority.literals, NO_PRIORITY_LANE],
    valueOf: () => (thread) => thread.priority ?? NO_PRIORITY_LANE,
    keepEmpty: false,
  },
  engagement: {
    values: () => ThreadEngagement.literals,
    valueOf: () => (thread) => thread.engagement,
    keepEmpty: true,
  },
  agentState: {
    values: () => THREAD_AGENT_STATES,
    valueOf: () => threadAgentState,
    keepEmpty: false,
  },
};

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
export function groupThreadsBy<T extends ThreadGroupInput>(
  threads: readonly T[],
  dimension: ThreadGroupDimension,
  context: ThreadGroupContext,
  parentPath: readonly string[] = [],
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
    if (laneThreads.length === 0 && !definition.keepEmpty) continue;
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
      readonly parentKey: string | null;
      readonly collapsed: boolean;
    }
  | {
      readonly kind: "thread";
      readonly thread: T;
      readonly depth: number;
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
): ThreadLaneRow<T>[] {
  const rows: ThreadLaneRow<T>[] = [];
  const visit = (laneThreads: readonly T[], depth: number, parent: ThreadLane<T> | null) => {
    const dimension = levels[depth];
    if (dimension === undefined) return;
    for (const lane of groupThreadsBy(laneThreads, dimension, context, parent?.path)) {
      const isCollapsed = collapsed.keys.has(lane.key);
      rows.push({
        kind: "lane",
        lane,
        depth,
        parentKey: parent?.key ?? null,
        collapsed: isCollapsed,
      });
      if (!isCollapsed && depth + 1 < levels.length) {
        visit(lane.threads, depth + 1, lane);
        continue;
      }
      for (const thread of lane.threads) {
        if (isCollapsed && !collapsed.keepWhenCollapsed(thread)) continue;
        rows.push({ kind: "thread", thread, depth, laneKey: lane.key });
      }
    }
  };
  visit(threads, 0, null);
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
}

/**
 * The changes that move a thread into the lane at `path`, one per settable level.
 * Project, Agent state and the Working section are not settable and are skipped.
 * An empty result means the header is not a drop target for this thread.
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
  return changes;
}
