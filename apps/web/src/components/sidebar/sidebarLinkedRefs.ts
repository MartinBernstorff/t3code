import type { LinearIssueId, LinearWorkspaceSlug } from "@t3tools/contracts";

import { linearIssueHref } from "../../linearIssue";

export interface SidebarLinkedRef {
  readonly kind: "linear" | "pull-request";
  readonly key: string;
  readonly label: string;
  /** Null when the URL can't be built; the chip then renders as plain text. */
  readonly url: string | null;
}

/** The Linear issue first, then each linked pull request, as chips for the sidebar row. */
export function resolveSidebarLinkedRefs(input: {
  readonly linearIssue: LinearIssueId | null;
  readonly linearWorkspaceSlug: LinearWorkspaceSlug | null | undefined;
  readonly pullRequests: ReadonlyArray<{ readonly number: number; readonly url: string }>;
}): ReadonlyArray<SidebarLinkedRef> {
  const refs: Array<SidebarLinkedRef> = [];
  if (input.linearIssue !== null) {
    refs.push({
      kind: "linear",
      key: `linear:${input.linearIssue}`,
      label: input.linearIssue,
      url: linearIssueHref(input.linearWorkspaceSlug, input.linearIssue),
    });
  }
  for (const pullRequest of input.pullRequests) {
    refs.push({
      kind: "pull-request",
      key: `pr:${pullRequest.url}`,
      label: `#${pullRequest.number}`,
      url: pullRequest.url,
    });
  }
  return refs;
}
