import { describe, expect, it } from "vite-plus/test";

import { groupThreadsBy, type ThreadGroupInput, threadLaneKey } from "./threadGrouping.ts";

type TestThread = ThreadGroupInput & { readonly id: string };

const thread = (id: string, overrides: Partial<TestThread> = {}): TestThread => ({
  id,
  environmentId: "env",
  projectId: "p1",
  priority: null,
  engagement: "inbox",
  ...overrides,
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
});
