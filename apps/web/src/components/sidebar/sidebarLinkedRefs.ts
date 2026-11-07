import type {
  LinearIssueId,
  LinearWorkspaceSlug,
  PullRequestState,
  ThreadPullRequestLink,
} from "@t3tools/contracts";
import { visibleThreadPullRequests } from "@t3tools/client-runtime/thread-pull-requests";

import { linearIssueHref } from "../../linearIssue";

export interface SidebarPullRequestState {
  readonly state: PullRequestState;
  readonly isDraft: boolean;
}

export interface SidebarLinkedRef {
  readonly kind: "linear" | "pull-request";
  readonly key: string;
  readonly label: string;
  /** Null when the URL can't be built; the chip then renders as plain text. */
  readonly url: string | null;
  /** Pull requests only; null until the state is known. */
  readonly pullRequestState: SidebarPullRequestState | null;
}

export interface SidebarLinkedRefs {
  readonly refs: ReadonlyArray<SidebarLinkedRef>;
  /** With more than one pull request, a pull request chip opens the thread's list instead. */
  readonly pullRequestChipsOpenList: boolean;
}

/**
 * The Linear issue first, then each linked pull request, as chips for the sidebar row.
 * Without visible links, the row's single resolved pull request (an older server's link
 * or the branch's) stands in.
 */
export function resolveSidebarLinkedRefs(input: {
  readonly linearIssue: LinearIssueId | null;
  readonly linearWorkspaceSlug: LinearWorkspaceSlug | null | undefined;
  readonly pullRequestLinks: ReadonlyArray<ThreadPullRequestLink>;
  readonly fallbackPullRequest: {
    readonly number: number;
    readonly url: string;
    readonly state: PullRequestState;
    readonly isDraft?: boolean | undefined;
  } | null;
}): SidebarLinkedRefs {
  const refs: Array<SidebarLinkedRef> = [];
  if (input.linearIssue !== null) {
    refs.push({
      kind: "linear",
      key: `linear:${input.linearIssue}`,
      label: input.linearIssue,
      url: linearIssueHref(input.linearWorkspaceSlug, input.linearIssue),
      pullRequestState: null,
    });
  }
  const links = visibleThreadPullRequests(input.pullRequestLinks);
  const pullRequests =
    links.length > 0
      ? links.map((link) => ({
          number: link.number,
          url: link.url,
          state:
            link.snapshot === null
              ? null
              : { state: link.snapshot.state, isDraft: link.snapshot.isDraft },
        }))
      : input.fallbackPullRequest === null
        ? []
        : [
            {
              number: input.fallbackPullRequest.number,
              url: input.fallbackPullRequest.url,
              state: {
                state: input.fallbackPullRequest.state,
                isDraft: input.fallbackPullRequest.isDraft === true,
              },
            },
          ];
  for (const pullRequest of pullRequests) {
    refs.push({
      kind: "pull-request",
      key: `pr:${pullRequest.url}`,
      label: `#${pullRequest.number}`,
      url: pullRequest.url,
      pullRequestState: pullRequest.state,
    });
  }
  return { refs, pullRequestChipsOpenList: pullRequests.length > 1 };
}
