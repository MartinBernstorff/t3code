import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "../test-fixtures";
import { matchesThreadPaletteQuery, searchThreadsForPalette } from "./ThreadSearchPalette.logic";

const NOW = "2026-03-10T12:00:00.000Z";

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
  const search = (query: string) =>
    searchThreadsForPalette({
      threads,
      query,
      projectTitleOf: (candidate) => (candidate.projectId === "project-api" ? "API" : "Web"),
      now: NOW,
    }).map((candidate) => candidate.title);

  it("lists every thread in sidebar order: pinned, active, snoozed, settled", () => {
    expect(search("")).toEqual([
      "pinned",
      "newer active",
      "older active",
      "linked",
      "snoozed",
      "settled",
    ]);
  });

  it("matches project names and pull request numbers", () => {
    expect(search("api")).toEqual(["newer active"]);
    expect(search("#4321")).toEqual(["linked"]);
    expect(search("mb-77")).toEqual(["linked"]);
    expect(search("web active")).toEqual(["older active"]);
  });
});
