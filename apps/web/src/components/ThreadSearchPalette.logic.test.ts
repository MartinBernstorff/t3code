import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "../test-fixtures";
import {
  matchesThreadPaletteQuery,
  searchThreadsForPalette,
  type ThreadPaletteLayout,
} from "./ThreadSearchPalette.logic";

const NOW = "2026-03-10T12:00:00.000Z";

const SECTION_LAYOUT: ThreadPaletteLayout = {
  groupBy: ["section"],
  threadSort: "manual",
  threadSortOverrides: {},
  workingShelfEnabled: false,
  boringSidebar: false,
  projects: [],
  inbox: { isWorking: () => false, returnedAt: () => undefined },
};

describe("matchesThreadPaletteQuery", () => {
  const terms = ["Fix sidebar lag", "Lakebed", "#123", "Smaller MCP payloads"];

  it.each([
    ["", true],
    ["sidebar", true],
    ["SIDEBAR lakebed", true],
    ["#123", true],
    ["123", true],
    ["mcp payloads", true],
    ["Lakébed", true],
    ["sidebar #124", false],
    ["deploy", false],
  ])("%j matches: %s", (query, expected) => {
    expect(matchesThreadPaletteQuery(terms, query)).toBe(expected);
  });
});

describe("searchThreadsForPalette", () => {
  const thread = (id: string, overrides: Parameters<typeof makeThreadFixture>[0] = {}) =>
    makeThreadFixture({
      id: ThreadId.make(id),
      title: id,
      createdAt: "2026-03-09T10:00:00.000Z",
      ...overrides,
    });
  const threads = [
    thread("settled", { settledOverride: "settled", settledAt: "2026-03-09T11:00:00.000Z" }),
    thread("snoozed", { snoozedUntil: "2026-03-11T00:00:00.000Z" }),
    thread("older active", { createdAt: "2026-03-08T10:00:00.000Z" }),
    thread("newer active", {
      createdAt: "2026-03-09T12:00:00.000Z",
      projectId: ProjectId.make("project-api"),
    }),
    thread("pinned", { pinnedAt: "2026-03-09T10:00:00.000Z" }),
    thread("archived", { archivedAt: "2026-03-09T10:00:00.000Z" }),
    thread("linked", {
      createdAt: "2026-03-07T10:00:00.000Z",
      linearIssue: "MB-77",
      linkedPullRequest: {
        projectId: ProjectId.make("project-test"),
        repository: "t3tools/t3code",
        number: 4321,
        url: "https://github.com/t3tools/t3code/pull/4321",
      },
    }),
  ];
  const searchGroups = (
    query: string,
    candidates: typeof threads = threads,
    layout: ThreadPaletteLayout = SECTION_LAYOUT,
  ) =>
    searchThreadsForPalette({
      threads: candidates,
      query,
      projectTitleOf: (candidate) => (candidate.projectId === "project-api" ? "API" : "Web"),
      now: NOW,
      layout,
    }).map((group) => [group.label, group.threads.map((candidate) => candidate.title)]);
  const search = (query: string) => searchGroups(query).flatMap(([, titles]) => titles);

  it("groups unsettled threads like the sidebar: pinned, active, snoozed", () => {
    expect(searchGroups("")).toEqual([
      ["Pinned", ["pinned"]],
      ["Active", ["newer active", "older active", "linked"]],
      ["Snoozed", ["snoozed"]],
    ]);
    expect(search("settled")).toEqual([]);
  });

  it("groups by the sidebar's nested lanes under one header, each lane in its own order", () => {
    const laneThreads = [
      thread("newer low", {
        engagement: "inbox",
        priority: "low",
        createdAt: "2026-03-09T12:00:00.000Z",
      }),
      thread("older urgent", { engagement: "inbox", priority: "urgent" }),
      thread("engaged", { engagement: "engaged" }),
      thread("running", { engagement: "engaged" }),
    ];
    const [first] = laneThreads;
    expect(
      searchGroups("", laneThreads, {
        ...SECTION_LAYOUT,
        groupBy: ["engagement", "project"],
        threadSortOverrides: { "engagement:inbox": "priority" },
        workingShelfEnabled: true,
        projects: [
          {
            projectKey: "web",
            displayName: "Web",
            memberProjectRefs: [
              { environmentId: first!.environmentId, projectId: first!.projectId },
            ],
          },
        ],
        inbox: {
          isWorking: (candidate) => candidate.title === "running",
          returnedAt: () => undefined,
        },
      }),
    ).toEqual([
      ["Engaged › Web", ["engaged"]],
      ["Inbox › Web", ["older urgent", "newer low"]],
      ["Working", ["running"]],
    ]);
  });

  it("matches project names and pull request numbers", () => {
    expect(search("api")).toEqual(["newer active"]);
    expect(search("#4321")).toEqual(["linked"]);
    expect(search("mb-77")).toEqual(["linked"]);
    expect(search("web active")).toEqual(["older active"]);
  });
});
