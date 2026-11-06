import { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupThreadsBy,
  threadAgentState,
  type ThreadGroupInput,
  threadLaneKey,
} from "./threadGrouping.ts";

type TestThread = ThreadGroupInput & { readonly id: string };

const thread = (id: string, overrides: Partial<TestThread> = {}): TestThread => ({
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
});

const runtime = (status: "running" | "idle" | "failed") => ({
  status,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const NO_PROJECTS = { projects: [] };
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
      },
    );
    expect(summarize(lanes)).toEqual([
      ["repo-b", ["b"]],
      ["repo-a", ["a", "c"]],
      ["env:p9", ["d"]],
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
