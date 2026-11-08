import { sortWorkingThreadsBySend } from "@t3tools/client-runtime/state/thread-inbox";
import {
  threadLaneRows,
  type ThreadGroupSection,
} from "@t3tools/client-runtime/state/thread-grouping";
import type {
  SidebarGroupByLevels,
  SidebarThreadSort,
  SidebarThreadSortOverrides,
} from "@t3tools/contracts/settings";
import { foldSearchQuery } from "@t3tools/shared/paletteSearch";
import { threadSearchPullRequests } from "@t3tools/shared/threadPullRequests";

import type { SidebarProjectSnapshot } from "../sidebarProjectGrouping";
import type { SidebarThreadSummary } from "../types";
import {
  firstValidTimestampMs,
  isSidebarHiddenThread,
  orderSidebarLaneThreads,
  resolveSidebarThreadShelf,
  sidebarLaneLabel,
  sortPinnedThreadsForSidebar,
  sortSidebarActiveThreads,
  type SidebarInboxReader,
  type SidebarSection,
} from "./Sidebar.logic";

/** Everything the thread search palette matches a thread by. */
function threadPaletteSearchTerms(
  thread: SidebarThreadSummary,
  projectTitle: string | null,
): string[] {
  return [
    thread.title,
    projectTitle ?? "",
    ...threadSearchPullRequests(thread).flatMap((pullRequest) => [
      `#${pullRequest.number}`,
      pullRequest.title ?? "",
    ]),
    thread.linearIssue ?? "",
  ];
}

/** Every query word must appear in some term, ignoring case and accents. */
export function matchesThreadPaletteQuery(terms: ReadonlyArray<string>, query: string): boolean {
  const tokens = foldSearchQuery(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const folded = terms.map(foldSearchQuery);
  return tokens.every((token) => folded.some((term) => term.includes(token)));
}

/** The sidebar settings the picker mirrors. */
export interface ThreadPaletteLayout {
  readonly groupBy: SidebarGroupByLevels;
  readonly threadSort: SidebarThreadSort;
  readonly threadSortOverrides: SidebarThreadSortOverrides;
  readonly workingShelfEnabled: boolean;
  readonly boringSidebar: boolean;
  /** Project lanes in sidebar order. */
  readonly projects: ReadonlyArray<
    Pick<SidebarProjectSnapshot, "projectKey" | "displayName" | "memberProjectRefs">
  >;
  readonly inbox: SidebarInboxReader;
}

export interface ThreadPaletteGroup {
  readonly key: string;
  /** Nested lanes share one header, outermost first, so the picker needs no indentation. */
  readonly label: string;
  readonly threads: readonly SidebarThreadSummary[];
}

/**
 * The minimal sidebar's sections across every project: its lanes, or Pinned and Active, then
 * the Working, Waiting, and Snoozed shelves. Settled threads are left out.
 */
function groupThreadsLikeSidebar(
  threads: ReadonlyArray<SidebarThreadSummary>,
  now: string,
  layout: ThreadPaletteLayout,
): ThreadPaletteGroup[] {
  const { groupBy, boringSidebar } = layout;
  // As in the sidebar: boring mode keeps project folders, and Section alone means no lanes.
  const laneLevels =
    !boringSidebar && !(groupBy.length === 1 && groupBy[0] === "section") ? groupBy : null;
  const workingShelfEnabled = layout.workingShelfEnabled && !boringSidebar;
  const sections: Record<SidebarSection, SidebarThreadSummary[]> = {
    pinned: [],
    active: [],
    working: [],
    waiting: [],
    snoozed: [],
    settled: [],
  };
  for (const thread of threads) {
    if (thread.archivedAt !== null || isSidebarHiddenThread(thread)) continue;
    const shelf = resolveSidebarThreadShelf(thread, {
      now,
      configLoaded: true,
      workingShelfEnabled,
      pinnedJoinWorking: laneLevels !== null,
      inbox: layout.inbox,
    });
    sections[shelf].push(thread);
  }
  const pinned = sortPinnedThreadsForSidebar(sections.pinned);
  const active = sortSidebarActiveThreads(sections.active, {
    // Lanes sort themselves, so they start from the manual order.
    threadSort: laneLevels !== null ? "manual" : layout.threadSort,
    sortActiveBySend: boringSidebar,
    workingShelfEnabled,
    returnedAt: layout.inbox.returnedAt,
  });
  const leading =
    laneLevels === null
      ? [
          { key: "pinned", label: "Pinned", threads: pinned },
          { key: "active", label: "Active", threads: active },
        ]
      : laneGroups(pinned, active, laneLevels, layout);
  return [
    ...leading,
    { key: "working", label: "Working", threads: sortWorkingThreadsBySend(sections.working) },
    {
      key: "waiting",
      label: "Waiting on others",
      threads: sortWorkingThreadsBySend(sections.waiting),
    },
    {
      key: "snoozed",
      label: "Snoozed",
      threads: sections.snoozed.toSorted(
        (left, right) =>
          firstValidTimestampMs(left.snoozedUntil) - firstValidTimestampMs(right.snoozedUntil),
      ),
    },
  ];
}

/** One group per innermost lane, labelled with every level of its path. */
function laneGroups(
  pinned: readonly SidebarThreadSummary[],
  active: readonly SidebarThreadSummary[],
  laneLevels: SidebarGroupByLevels,
  layout: ThreadPaletteLayout,
): ThreadPaletteGroup[] {
  const pinnedSet: ReadonlySet<unknown> = new Set(pinned);
  const rows = threadLaneRows(
    [...pinned, ...active],
    laneLevels,
    {
      projects: layout.projects.map((project) => ({
        key: project.projectKey,
        memberProjectKeys: project.memberProjectRefs.map(
          (ref) => `${ref.environmentId}:${ref.projectId}`,
        ),
      })),
      sectionOf: (thread): ThreadGroupSection => (pinnedSet.has(thread) ? "pinned" : "active"),
    },
    { keys: new Set(), keepWhenCollapsed: () => true },
    { orderLaneThreads: orderSidebarLaneThreads(layout.threadSort, layout.threadSortOverrides) },
  );
  const pathLabels: string[] = [];
  const groups = new Map<string, { key: string; label: string; threads: SidebarThreadSummary[] }>();
  for (const row of rows) {
    if (row.kind === "lane") {
      pathLabels.length = row.depth;
      pathLabels.push(sidebarLaneLabel(row.lane, layout.projects));
      continue;
    }
    const group = groups.get(row.laneKey);
    if (group) group.threads.push(row.thread);
    else {
      groups.set(row.laneKey, {
        key: `lane:${row.laneKey}`,
        label: pathLabels.join(" › "),
        threads: [row.thread],
      });
    }
  }
  return [...groups.values()];
}

/**
 * The picker's groups with only the threads matching `query` inside the sidebar's project
 * scope (`environmentId:projectId` keys, null for every project); empty groups are dropped.
 */
export function searchThreadsForPalette(input: {
  readonly threads: ReadonlyArray<SidebarThreadSummary>;
  readonly query: string;
  readonly scopedProjectKeys: ReadonlySet<string> | null;
  readonly projectTitleOf: (thread: SidebarThreadSummary) => string | null;
  readonly now: string;
  readonly layout: ThreadPaletteLayout;
}): ThreadPaletteGroup[] {
  const { scopedProjectKeys } = input;
  const threads =
    scopedProjectKeys === null
      ? input.threads
      : input.threads.filter((thread) =>
          scopedProjectKeys.has(`${thread.environmentId}:${thread.projectId}`),
        );
  return groupThreadsLikeSidebar(threads, input.now, input.layout).flatMap((group) => {
    const threads = group.threads.filter((thread) =>
      matchesThreadPaletteQuery(
        threadPaletteSearchTerms(thread, input.projectTitleOf(thread)),
        input.query,
      ),
    );
    return threads.length === 0 ? [] : [{ ...group, threads }];
  });
}
