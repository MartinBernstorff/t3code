import { describe, expect, it } from "vite-plus/test";

import { linearIssueHref, parseLinearIssueInput, parseLinearWorkspaceInput } from "./linearIssue";

describe("parseLinearIssueInput", () => {
  it.each([
    ["MB-123", "MB-123"],
    [" mb-123 ", "MB-123"],
    ["https://linear.app/acme/issue/ENG-42/fix-the-thing", "ENG-42"],
    ["", null],
    ["   ", null],
    ["MB123", undefined],
    ["MB-0", undefined],
    ["https://linear.app/acme/project/foo", undefined],
  ])("%j reads as %j", (input, expected) => {
    expect(parseLinearIssueInput(input)).toBe(expected);
  });
});

describe("parseLinearWorkspaceInput", () => {
  it.each([
    ["acme", "acme"],
    ["Acme-Co", "acme-co"],
    ["https://linear.app/acme/issue/ENG-42", "acme"],
    ["", null],
    ["acme corp", undefined],
  ])("%j reads as %j", (input, expected) => {
    expect(parseLinearWorkspaceInput(input)).toBe(expected);
  });
});

describe("linearIssueHref", () => {
  it("links only when the project has a workspace", () => {
    expect(linearIssueHref("acme", "MB-1")).toBe("https://linear.app/acme/issue/MB-1");
    expect(linearIssueHref(null, "MB-1")).toBeNull();
  });
});
