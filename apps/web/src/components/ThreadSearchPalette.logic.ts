import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import { sortSettledThreads } from "@t3tools/client-runtime/state/thread-sort";
import { foldSearchQuery } from "@t3tools/shared/paletteSearch";
import { threadSearchPullRequests } from "@t3tools/shared/threadPullRequests";

import type { SidebarThreadSummary } from "../types";
import {
  firstValidTimestampMs,
  isSidebarHiddenThread,
  resolveSidebarThreadSection,
  sortPinnedThreadsForSidebar,
  sortThreadsForSidebar,
} from "./Sidebar.logic";

/** Everything the thread search palette matches a thread by. */
export function threadPaletteSearchTerms(
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
  ];
}

/** Every query word must appear in some term, ignoring case and accents. */
export function matchesThreadPaletteQuery(terms: ReadonlyArray<string>, query: string): boolean {
  const tokens = foldSearchQuery(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const folded = terms.map(foldSearchQuery);
  return tokens.every((token) => folded.some((term) => term.includes(token)));
}

/**
 * Sidebar order across every project: pinned, active, snoozed, then settled.
 * The Working shelf is not split out; its threads sort with the active ones.
 */
export function orderThreadsLikeSidebar(
  threads: ReadonlyArray<SidebarThreadSummary>,
  now: string,
): SidebarThreadSummary[] {
  const pinned: SidebarThreadSummary[] = [];
  const active: SidebarThreadSummary[] = [];
  const snoozed: SidebarThreadSummary[] = [];
  const settled: SidebarThreadSummary[] = [];
  for (const thread of threads) {
    if (thread.archivedAt !== null || isSidebarHiddenThread(thread)) continue;
    const section = resolveSidebarThreadSection({
      snoozed: effectiveSnoozed(thread, { now }),
      settled: thread.settledOverride === "settled",
      pinned: thread.pinnedAt != null,
    });
    (section === "pinned"
      ? pinned
      : section === "snoozed"
        ? snoozed
        : section === "settled"
          ? settled
          : active
    ).push(thread);
  }
  return [
    ...sortPinnedThreadsForSidebar(pinned),
    ...sortThreadsForSidebar(active),
    ...snoozed.toSorted(
      (left, right) =>
        firstValidTimestampMs(left.snoozedUntil) - firstValidTimestampMs(right.snoozedUntil),
    ),
    ...sortSettledThreads(settled),
  ];
}

export function searchThreadsForPalette(input: {
  readonly threads: ReadonlyArray<SidebarThreadSummary>;
  readonly query: string;
  readonly projectTitleOf: (thread: SidebarThreadSummary) => string | null;
  readonly now: string;
}): SidebarThreadSummary[] {
  return orderThreadsLikeSidebar(input.threads, input.now).filter((thread) =>
    matchesThreadPaletteQuery(
      threadPaletteSearchTerms(thread, input.projectTitleOf(thread)),
      input.query,
    ),
  );
}
