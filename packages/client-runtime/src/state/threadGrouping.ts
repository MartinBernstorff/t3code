import { ThreadEngagement, ThreadPriority } from "@t3tools/contracts";
import type { SidebarGroupBy } from "@t3tools/contracts/settings";

/** Dimensions grouped here; "section" stays the sidebar's own pinned/active/shelf split. */
export type ThreadGroupDimension = Exclude<SidebarGroupBy, "section">;

export interface ThreadGroupInput {
  readonly environmentId: string;
  readonly projectId: string;
  readonly priority: ThreadPriority | null;
  readonly engagement: ThreadEngagement;
}

export interface ThreadGroupProject {
  readonly key: string;
  /** `${environmentId}:${projectId}` of each project folded into this group. */
  readonly memberProjectKeys: readonly string[];
}

export interface ThreadGroupContext {
  /** Project lanes in display order. */
  readonly projects: readonly ThreadGroupProject[];
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
};

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
