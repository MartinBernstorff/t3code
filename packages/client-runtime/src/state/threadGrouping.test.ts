import { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupThreadsBy,
  threadAgentState,
  type ThreadGroupInput,
  type ThreadGroupSection,
  threadLaneDropChanges,
  threadLaneKey,
  threadLaneRows,
  withThreadGroupLevel,
} from "./threadGrouping.ts";

type TestThread = ThreadGroupInput & { readonly id: string };

// The sidebar looks sections up by shell identity; the fixtures do the same.
const sections = new WeakMap<ThreadGroupInput, ThreadGroupSection>();
const sectionOf = (input: ThreadGroupInput) => sections.get(input) ?? "active";

const thread = (
  id: string,
  { section = "active", ...overrides }: Partial<TestThread> & { section?: ThreadGroupSection } = {},
): TestThread => {
  const created: TestThread = {
    id,
    environmentId: "env",
    projectId: "p1",
    priority: null,
    engagement: "inbox",
    hasActionableProposedPlan: false,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    interactionMode: "default",
    latestRun: null,
    runtime: null,
    waitingOnOthers: false,
    ...overrides,
  };
  sections.set(created, section);
  return created;
};

const runtime = (status: "running" | "idle" | "failed") => ({
  status,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const NO_PROJECTS = { projects: [], sectionOf };
const summarize = (lanes: ReturnType<typeof groupThreadsBy<TestThread>>) =>
  lanes.map((lane) => [lane.value, lane.threads.map((t) => t.id)]);

describe("groupThreadsBy", () => {
  it("orders priority lanes most urgent first and drops empty ones", () => {
    const lanes = groupThreadsBy(
      [
        thread("a"),
        thread("b", { priority: "low" }),
        thread("c", { priority: "urgent" }),
        thread("d", { priority: "low" }),
      ],
      "priority",
      NO_PROJECTS,
    );
    expect(summarize(lanes)).toEqual([
      ["urgent", ["c"]],
      ["low", ["b", "d"]],
      ["none", ["a"]],
    ]);
  });

  it("keeps every engagement lane, even empty ones", () => {
    const lanes = groupThreadsBy(
      [thread("a", { engagement: "queued" })],
      "engagement",
      NO_PROJECTS,
    );
    expect(summarize(lanes)).toEqual([
      ["engaged", []],
      ["inbox", []],
      ["queued", ["a"]],
    ]);
  });

  it("folds member projects into their group in project order, unknown projects last", () => {
    const lanes = groupThreadsBy(
      [
        thread("a", { projectId: "p1" }),
        thread("b", { projectId: "p3" }),
        thread("c", { projectId: "p2" }),
        thread("d", { projectId: "p9" }),
      ],
      "project",
      {
        projects: [
          { key: "repo-b", memberProjectKeys: ["env:p3"] },
          { key: "repo-a", memberProjectKeys: ["env:p1", "env:p2"] },
          { key: "repo-empty", memberProjectKeys: ["env:p4"] },
        ],
        sectionOf,
      },
    );
    expect(summarize(lanes)).toEqual([
      ["repo-b", ["b"]],
      ["repo-a", ["a", "c"]],
      ["env:p9", ["d"]],
    ]);
  });

  it("orders section lanes pinned, active, working and drops empty ones", () => {
    const lanes = groupThreadsBy(
      [thread("a", { section: "working" }), thread("b"), thread("c", { section: "working" })],
      "section",
      NO_PROJECTS,
    );
    expect(summarize(lanes)).toEqual([
      ["active", ["b"]],
      ["working", ["a", "c"]],
    ]);
  });

  it("keys lanes by path so nested levels stay distinct", () => {
    const [outer] = groupThreadsBy([thread("a", { priority: "high" })], "priority", NO_PROJECTS);
    const nested = groupThreadsBy(outer!.threads, "engagement", NO_PROJECTS, outer!.path);
    expect(outer!.key).toBe("priority%3Ahigh");
    expect(nested.map((lane) => lane.path)).toEqual([
      ["priority:high", "engagement:engaged"],
      ["priority:high", "engagement:inbox"],
      ["priority:high", "engagement:queued"],
    ]);
    expect(threadLaneKey(["project:env:a/b", "priority:low"])).toBe(
      "project%3Aenv%3Aa%2Fb/priority%3Alow",
    );
  });

  it("orders agent-state lanes needs-you first and drops empty ones", () => {
    const lanes = groupThreadsBy(
      [
        thread("a", { waitingOnOthers: true }),
        thread("b", { runtime: runtime("running") }),
        thread("c"),
      ],
      "agentState",
      NO_PROJECTS,
    );
    expect(summarize(lanes)).toEqual([
      ["needsYou", ["c"]],
      ["working", ["b"]],
      ["waitingOnOthers", ["a"]],
    ]);
  });
});

describe("threadAgentState", () => {
  it.each([
    ["a finished turn", {}, "needsYou"],
    ["a failed turn", { runtime: runtime("failed") }, "needsYou"],
    ["a running turn", { runtime: runtime("running") }, "working"],
    ["background work holding the turn open", { runtime: runtime("idle") }, "working"],
    [
      "an approval request mid-run",
      { runtime: runtime("running"), hasPendingApprovals: true },
      "needsYou",
    ],
    ["a pending user-input request", { hasPendingUserInput: true }, "needsYou"],
    ["a subagent request", { pendingSubagentRequest: "approval" as const }, "needsYou"],
    ["a waiting guest message", { pendingGuestMessageCount: 1 }, "needsYou"],
    ["the waiting flag after the turn ended", { waitingOnOthers: true }, "waitingOnOthers"],
    [
      "the waiting flag while a turn runs",
      { waitingOnOthers: true, runtime: runtime("running") },
      "working",
    ],
    [
      "the waiting flag with an open approval",
      { waitingOnOthers: true, hasPendingApprovals: true },
      "needsYou",
    ],
  ] as const)("%s", (_name, overrides, expected) => {
    expect(threadAgentState(thread("a", overrides))).toBe(expected);
  });
});

describe("threadLaneRows", () => {
  const threads = [
    thread("a", { priority: "high", section: "pinned" }),
    thread("b", { priority: "high" }),
    thread("c", { priority: "low", section: "working" }),
  ];
  const summarizeRows = (rows: ReturnType<typeof threadLaneRows<TestThread>>) =>
    rows.map((row) =>
      row.kind === "lane"
        ? `${"  ".repeat(row.depth)}${row.lane.value}${row.collapsed ? " (collapsed)" : ""}`
        : `${"  ".repeat(row.depth)}- ${row.thread.id}`,
    );
  const expanded = { keys: new Set<string>(), keepWhenCollapsed: () => false };

  it("nests each level inside the one above, either way round", () => {
    expect(
      summarizeRows(threadLaneRows(threads, ["section", "priority"], NO_PROJECTS, expanded)),
    ).toEqual([
      "pinned",
      "  high",
      "  - a",
      "active",
      "  high",
      "  - b",
      "working",
      "  low",
      "  - c",
    ]);
    expect(
      summarizeRows(threadLaneRows(threads, ["priority", "section"], NO_PROJECTS, expanded)),
    ).toEqual(["high", "  pinned", "  - a", "  active", "  - b", "low", "  working", "  - c"]);
  });

  it("collapses a lane by its full path without touching same-value lanes elsewhere", () => {
    const rows = threadLaneRows(threads, ["section", "priority"], NO_PROJECTS, {
      keys: new Set([threadLaneKey(["section:active", "priority:high"])]),
      keepWhenCollapsed: () => false,
    });
    expect(summarizeRows(rows)).toEqual([
      "pinned",
      "  high",
      "  - a",
      "active",
      "  high (collapsed)",
      "working",
      "  low",
      "  - c",
    ]);
    expect(rows.flatMap((row) => (row.kind === "lane" ? [row.parentKey] : []))).toEqual([
      null,
      threadLaneKey(["section:pinned"]),
      null,
      threadLaneKey(["section:active"]),
      null,
      threadLaneKey(["section:working"]),
    ]);
  });

  it("hides nested lanes of a collapsed parent but keeps the threads it is told to", () => {
    const rows = threadLaneRows(threads, ["priority", "section"], NO_PROJECTS, {
      keys: new Set([threadLaneKey(["priority:high"])]),
      keepWhenCollapsed: (t) => t.id === "b",
    });
    expect(summarizeRows(rows)).toEqual(["high (collapsed)", "- b", "low", "  working", "  - c"]);
  });
});

describe("withThreadGroupLevel", () => {
  it.each([
    [["section"], 1, "priority", ["section", "priority"]],
    [["section", "priority"], 0, "priority", ["priority"]],
    [["section", "priority", "project"], 1, "section", ["section", "project"]],
    [["section", "priority", "project"], 0, "engagement", ["engagement", "priority", "project"]],
    [["section", "priority", "project"], 1, null, ["section"]],
    [["priority"], 0, null, ["priority"]],
  ] as const)("%j with level %i set to %s gives %j", (levels, index, dimension, expected) => {
    expect(withThreadGroupLevel(levels, index, dimension)).toEqual(expected);
  });
});

describe("threadLaneDropChanges", () => {
  const plain = { priority: null, engagement: "inbox", pinned: false, section: "active" } as const;

  it.each([
    ["sets priority", ["priority:high"], plain, [{ kind: "priority", priority: "high" }]],
    [
      "clears priority",
      ["priority:none"],
      { ...plain, priority: "low" },
      [{ kind: "priority", priority: null }],
    ],
    [
      "sets engagement",
      ["engagement:queued"],
      plain,
      [{ kind: "engagement", engagement: "queued" }],
    ],
    ["pins", ["section:pinned"], plain, [{ kind: "pin" }]],
    ["unpins onto Active", ["section:active"], { ...plain, pinned: true }, [{ kind: "unpin" }]],
    [
      "wakes a snoozed thread onto Active",
      ["section:active"],
      { ...plain, section: "snoozed" },
      [{ kind: "unsnooze" }],
    ],
    [
      "un-settles a settled thread onto Active",
      ["section:active"],
      { ...plain, section: "settled" },
      [{ kind: "unsettle" }],
    ],
    [
      "ignores the lane the thread is already in",
      ["priority:high"],
      { ...plain, priority: "high" },
      [],
    ],
    ["has no Working target", ["section:working"], plain, []],
    ["has no Project or Agent state target", ["project:env:p1", "agentState:needsYou"], plain, []],
    [
      "sets every settable level of a nested path",
      ["project:env:p1", "engagement:queued", "priority:urgent"],
      plain,
      [
        { kind: "priority", priority: "urgent" },
        { kind: "engagement", engagement: "queued" },
      ],
    ],
    [
      "restores engagement after a priority drop engages the thread",
      ["priority:high", "engagement:inbox"],
      plain,
      [
        { kind: "priority", priority: "high" },
        { kind: "engagement", engagement: "inbox" },
      ],
    ],
    [
      "skips engagement a priority drop already sets",
      ["priority:high", "engagement:engaged"],
      plain,
      [{ kind: "priority", priority: "high" }],
    ],
  ] as const)("%s", (_name, path, input, expected) => {
    expect(threadLaneDropChanges(path, input)).toEqual(expected);
  });
});
