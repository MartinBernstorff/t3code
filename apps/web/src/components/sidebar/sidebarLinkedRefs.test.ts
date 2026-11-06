import { describe, expect, it } from "vite-plus/test";

import { resolveSidebarLinkedRefs } from "./sidebarLinkedRefs";

const PR_A = { number: 12, url: "https://github.com/acme/app/pull/12" };
const PR_B = { number: 15, url: "https://github.com/acme/app/pull/15" };

describe("resolveSidebarLinkedRefs", () => {
  it.each([
    {
      name: "lists the Linear issue before pull requests",
      linearIssue: "MB-7",
      slug: "acme",
      pullRequests: [PR_A, PR_B],
      expected: [
        { label: "MB-7", url: "https://linear.app/acme/issue/MB-7" },
        { label: "#12", url: PR_A.url },
        { label: "#15", url: PR_B.url },
      ],
    },
    {
      name: "leaves the Linear chip without a URL when the project has no workspace",
      linearIssue: "MB-7",
      slug: null,
      pullRequests: [],
      expected: [{ label: "MB-7", url: null }],
    },
    {
      name: "is empty with nothing linked",
      linearIssue: null,
      slug: "acme",
      pullRequests: [],
      expected: [],
    },
  ] as const)("$name", ({ linearIssue, slug, pullRequests, expected }) => {
    const refs = resolveSidebarLinkedRefs({
      linearIssue,
      linearWorkspaceSlug: slug,
      pullRequests,
    });
    expect(refs.map(({ label, url }) => ({ label, url }))).toEqual(expected);
  });
});
