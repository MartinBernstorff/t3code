import { useState } from "react";
import type { ThreadPullRequestLink, ThreadPullRequestStack } from "@t3tools/contracts";
import { visibleThreadPullRequests } from "@t3tools/client-runtime/thread-pull-requests";

type StackThread = { readonly pullRequests: ReadonlyArray<ThreadPullRequestLink> };

export type SidebarStackStep = "merged" | "closed" | "finished" | "next" | "open";

export interface SidebarStackPlacement {
  /** 1 is the layer nearest the base. */
  readonly layer: number;
  readonly size: number;
  readonly isNext: boolean;
  readonly runStart: boolean;
  readonly runEnd: boolean;
  /** Set on a run's first row, which draws the stack's header. */
  readonly header: {
    readonly base: string;
    readonly steps: ReadonlyArray<SidebarStackStep>;
  } | null;
}

interface Membership {
  readonly stack: ThreadPullRequestStack;
  readonly index: number;
}

function stackMembership(thread: StackThread): Membership | null {
  for (const link of visibleThreadPullRequests(thread.pullRequests)) {
    if (link.stack === null) continue;
    const index = link.stack.layers.findIndex((layer) => layer.number === link.number);
    if (index !== -1) return { stack: link.stack, index };
  }
  return null;
}

/**
 * Pulls threads of one native stack together at the first member's slot, top layer first.
 * Returns the input when nothing moves, so callers keep their memoized lists.
 */
export function groupSidebarStackRuns<T extends StackThread>(threads: readonly T[]): readonly T[] {
  const membershipOf = new Map<T, Membership>();
  const membersByStack = new Map<string, T[]>();
  for (const thread of threads) {
    const membership = stackMembership(thread);
    if (membership === null) continue;
    membershipOf.set(thread, membership);
    const members = membersByStack.get(membership.stack.id);
    if (members === undefined) membersByStack.set(membership.stack.id, [thread]);
    else members.push(thread);
  }
  if (![...membersByStack.values()].some((members) => members.length > 1)) return threads;
  const grouped: T[] = [];
  const placed = new Set<string>();
  for (const thread of threads) {
    const membership = membershipOf.get(thread);
    if (membership === undefined) {
      grouped.push(thread);
      continue;
    }
    if (placed.has(membership.stack.id)) continue;
    placed.add(membership.stack.id);
    grouped.push(
      ...membersByStack
        .get(membership.stack.id)!
        .toSorted((left, right) => membershipOf.get(right)!.index - membershipOf.get(left)!.index),
    );
  }
  return grouped.every((thread, index) => thread === threads[index]) ? threads : grouped;
}

/**
 * Places rows that sit next to another row of their stack. Segments are the runs of rows the
 * sidebar draws without a header between them. The next layer is the lowest open one whose
 * thread is listed, including in collapsed shelves, and not finished.
 */
export function resolveSidebarStackPlacements<T extends StackThread>(input: {
  readonly segments: ReadonlyArray<ReadonlyArray<T>>;
  readonly threads: ReadonlyArray<T>;
  readonly isFinished: (thread: T) => boolean;
  readonly keyOf: (thread: T) => string;
}): ReadonlyMap<string, SidebarStackPlacement> {
  const placements = new Map<string, SidebarStackPlacement>();
  const memberships = input.segments.map((segment) => segment.map(stackMembership));
  const threadsByStack = new Map<string, Map<number, T>>();
  for (const thread of input.threads) {
    const membership = stackMembership(thread);
    if (membership === null) continue;
    const byLayer = threadsByStack.get(membership.stack.id) ?? new Map<number, T>();
    threadsByStack.set(membership.stack.id, byLayer);
    if (!byLayer.has(membership.index)) byLayer.set(membership.index, thread);
  }
  const stepsOf = (stack: ThreadPullRequestStack): SidebarStackStep[] => {
    const byLayer = threadsByStack.get(stack.id);
    let nextFound = false;
    return stack.layers.map((layer, index) => {
      if (layer.state === "merged" || layer.state === "closed") return layer.state;
      const thread = byLayer?.get(index);
      if (thread === undefined) return "open";
      if (input.isFinished(thread)) return "finished";
      if (nextFound) return "open";
      nextFound = true;
      return "next";
    });
  };
  for (const [segmentIndex, segment] of input.segments.entries()) {
    const segmentMemberships = memberships[segmentIndex]!;
    let start = 0;
    while (start < segment.length) {
      const membership = segmentMemberships[start];
      let end = start + 1;
      while (end < segment.length && segmentMemberships[end]?.stack.id === membership?.stack.id) {
        end += 1;
      }
      if (membership && end - start > 1) {
        const steps = stepsOf(membership.stack);
        for (let index = start; index < end; index += 1) {
          const { stack, index: layerIndex } = segmentMemberships[index]!;
          placements.set(input.keyOf(segment[index]!), {
            layer: layerIndex + 1,
            size: stack.layers.length,
            isNext: steps[layerIndex] === "next",
            runStart: index === start,
            runEnd: index === end - 1,
            header: index === start ? { base: stack.base, steps } : null,
          });
        }
      }
      start = end;
    }
  }
  return placements;
}

/** Keeps the previous placements while they are unchanged, so memoized rows skip rendering. */
export function useStableStackPlacements(
  placements: ReadonlyMap<string, SidebarStackPlacement>,
): ReadonlyMap<string, SidebarStackPlacement> {
  const signature = JSON.stringify([...placements]);
  const [stable, setStable] = useState({ signature, placements });
  if (stable.signature !== signature) {
    setStable({ signature, placements });
    return placements;
  }
  return stable.placements;
}
