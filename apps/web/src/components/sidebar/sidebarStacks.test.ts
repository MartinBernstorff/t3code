import type { PullRequestState, ThreadPullRequestLink } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupSidebarStackRuns,
  liveStackMembership,
  resolveSidebarStackPlacements,
  savedStackMembership,
} from "./sidebarStacks";

const stack = (id: string, states: ReadonlyArray<PullRequestState>, firstNumber: number) => ({
  kind: "native" as const,
  id,
  number: 1,
  url: `https://github.com/acme/app/stacks/${id}`,
  base: "main",
  layers: states.map((state, index) => ({
    number: firstNumber + index,
    headBranch: `head-${firstNumber + index}`,
    state,
  })),
});

const NINE = stack("nine", ["merged", "merged", "merged", ...Array(6).fill("open")], 4070);
const FOUR = stack("four", ["open", "open", "open", "open"], 3882);

interface TestThread {
  readonly key: string;
  readonly finished: boolean;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
}

const thread = (
  key: string,
  member: { stack: typeof NINE; layer: number } | null,
  finished = false,
): TestThread => ({
  key,
  finished,
  pullRequests:
    member === null
      ? []
      : [
          {
            host: "github.com",
            repository: "acme/app",
            number: member.stack.layers[member.layer - 1]!.number,
            url: "https://github.com/acme/app/pull/1",
            source: "manual",
            linkedAt: "2026-01-01T00:00:00.000Z",
            snapshot: null,
            stack: member.stack,
          } as ThreadPullRequestLink,
        ],
});

const keys = (threads: ReadonlyArray<TestThread>) => threads.map((entry) => entry.key);

describe("groupSidebarStackRuns", () => {
  it("pulls a stack together at its first member's slot, top layer first", () => {
    const threads = [
      thread("l8", { stack: NINE, layer: 8 }),
      thread("l6", { stack: NINE, layer: 6 }),
      thread("other", null),
      thread("four-1", { stack: FOUR, layer: 1 }),
      thread("l7", { stack: NINE, layer: 7 }),
    ];
    expect(keys(groupSidebarStackRuns(threads, savedStackMembership))).toEqual([
      "l8",
      "l7",
      "l6",
      "other",
      "four-1",
    ]);
  });

  it("groups threads known only from their branch through the host's stack read", () => {
    const live = new Map(
      [4073, 4077].map((number) => [
        `branch-${number}`,
        liveStackMembership(
          { ...NINE, layers: NINE.layers.map((layer) => ({ ...layer })) },
          number,
        ),
      ]),
    );
    const threads = [
      thread("branch-4073", null),
      thread("other", null),
      thread("branch-4077", null),
    ];
    expect(
      keys(
        groupSidebarStackRuns(
          threads,
          (entry) => savedStackMembership(entry) ?? live.get(entry.key) ?? null,
        ),
      ),
    ).toEqual(["branch-4077", "branch-4073", "other"]);
  });

  it("returns the same list when no stack has two members", () => {
    const threads = [thread("l8", { stack: NINE, layer: 8 }), thread("other", null)];
    expect(groupSidebarStackRuns(threads, savedStackMembership)).toBe(threads);
  });
});

describe("resolveSidebarStackPlacements", () => {
  const resolve = (
    segments: ReadonlyArray<ReadonlyArray<TestThread>>,
    hidden: ReadonlyArray<TestThread> = [],
  ) =>
    resolveSidebarStackPlacements({
      segments,
      threads: [...segments.flat(), ...hidden],
      isFinished: (entry) => entry.finished,
      keyOf: (entry) => entry.key,
      membershipOf: savedStackMembership,
    });

  it("marks the lowest open, unfinished layer as next and heads the run", () => {
    const placements = resolve([
      [
        thread("l8", { stack: NINE, layer: 8 }),
        thread("l7", { stack: NINE, layer: 7 }, true),
        thread("l5", { stack: NINE, layer: 5 }),
        thread("l4", { stack: NINE, layer: 4 }, true),
        thread("four-1", { stack: FOUR, layer: 1 }),
      ],
    ]);
    expect(placements.get("l8")).toMatchObject({
      layer: 8,
      size: 9,
      isNext: false,
      runStart: true,
      header: {
        steps: [
          "merged",
          "merged",
          "merged",
          "finished",
          "next",
          "open",
          "finished",
          "open",
          "open",
        ],
      },
    });
    expect(placements.get("l5")).toMatchObject({ isNext: true, header: null });
    expect(placements.get("l4")).toMatchObject({ runEnd: true });
    expect(placements.has("four-1")).toBe(false);
  });

  it("counts threads in other segments and collapsed shelves but only places rows that share a run", () => {
    const placements = resolve(
      [
        [thread("l8", { stack: NINE, layer: 8 })],
        [thread("l5", { stack: NINE, layer: 5 }, true), thread("l6", { stack: NINE, layer: 6 })],
      ],
      [thread("l4", { stack: NINE, layer: 4 }, true)],
    );
    expect(placements.has("l8")).toBe(false);
    expect(placements.get("l5")?.header?.steps.slice(3, 8)).toEqual([
      "finished",
      "finished",
      "next",
      "open",
      "open",
    ]);
  });
});
