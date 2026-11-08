import type { ThreadPullRequestLink } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveSidebarLinkedRefs } from "./sidebarLinkedRefs";

const link = (
  number: number,
  overrides: Partial<ThreadPullRequestLink> = {},
): ThreadPullRequestLink =>
  ({
    host: "github.com",
    repository: "acme/app",
    number,
    url: `https://github.com/acme/app/pull/${number}`,
    source: "manual",
    linkedAt: "2026-01-01T00:00:00.000Z",
    snapshot: {
      state: "open",
      title: `PR ${number}`,
      headBranch: `head-${number}`,
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-01-01T00:00:00.000Z",
    },
    stack: null,
    ...overrides,
  }) as ThreadPullRequestLink;

const PR_A = link(12);
const PR_B = link(15, {
  snapshot: { ...PR_A.snapshot!, state: "open", isDraft: true },
});
const BRANCH_PR = {
  number: 20,
  url: "https://github.com/acme/app/pull/20",
  state: "merged" as const,
};
const OPEN = { state: "open", isDraft: false };

describe("resolveSidebarLinkedRefs", () => {
  it.each([
    {
      name: "lists the Linear issue before pull requests, and a stack's chips open the list",
      linearIssue: "MB-7",
      slug: "acme",
      links: [PR_A, PR_B],
      fallback: null,
      expected: [
        { label: "MB-7", url: "https://linear.app/acme/issue/MB-7", state: null },
        { label: "#12", url: PR_A.url, state: OPEN },
        { label: "#15", url: PR_B.url, state: { state: "open", isDraft: true } },
      ],
      opensList: true,
    },
    {
      name: "leaves the Linear chip without a URL when the project has no workspace",
      linearIssue: "MB-7",
      slug: null,
      links: [],
      fallback: null,
      expected: [{ label: "MB-7", url: null, state: null }],
      opensList: false,
    },
    {
      name: "is empty with nothing linked",
      linearIssue: null,
      slug: "acme",
      links: [],
      fallback: null,
      expected: [],
      opensList: false,
    },
    {
      name: "shows the branch's pull request when nothing is linked",
      linearIssue: null,
      slug: "acme",
      links: [link(3, { source: "stack-dismissed" })],
      fallback: BRANCH_PR,
      expected: [{ label: "#20", url: BRANCH_PR.url, state: { state: "merged", isDraft: false } }],
      opensList: false,
    },
    {
      name: "prefers linked pull requests over the branch's, unknown state until synced",
      linearIssue: null,
      slug: "acme",
      links: [link(12, { snapshot: null })],
      fallback: BRANCH_PR,
      expected: [{ label: "#12", url: PR_A.url, state: null }],
      opensList: false,
    },
  ] as const)("$name", ({ linearIssue, slug, links, fallback, expected, opensList }) => {
    const result = resolveSidebarLinkedRefs({
      linearIssue,
      linearWorkspaceSlug: slug,
      pullRequestLinks: links,
      fallbackPullRequest: fallback,
    });
    expect(
      result.refs.map(({ label, url, pullRequestState }) => ({
        label,
        url,
        state: pullRequestState,
      })),
    ).toEqual(expected);
    expect(result.pullRequestChipsOpenList).toBe(opensList);
  });
});
