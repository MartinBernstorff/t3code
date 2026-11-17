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
  /** Pull requests someone else wrote; null for the viewer's own or when unknown. */
  readonly author: string | null;
  /** The pull request's layer in a native stack, 1 nearest the base; null outside one or unknown. */
  readonly stack: SidebarPullRequestStackPosition | null;
}

export interface SidebarPullRequestStackPosition {
  readonly position: number;
  readonly size: number;
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
    readonly stack?: SidebarPullRequestStackPosition | null | undefined;
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
      author: null,
      stack: null,
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
          author:
            link.snapshot?.viewerIsAuthor === false ? (link.snapshot.author?.login ?? null) : null,
          stack: stackPositionOf(link),
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
              author: null,
              stack: input.fallbackPullRequest.stack ?? null,
            },
          ];
  for (const pullRequest of pullRequests) {
    refs.push({
      kind: "pull-request",
      key: `pr:${pullRequest.url}`,
      label: `#${pullRequest.number}`,
      url: pullRequest.url,
      pullRequestState: pullRequest.state,
      author: pullRequest.author,
      stack: pullRequest.stack,
    });
  }
  return { refs, pullRequestChipsOpenList: pullRequests.length > 1 };
}

function stackPositionOf(link: ThreadPullRequestLink): SidebarPullRequestStackPosition | null {
  if (link.stack === null) return null;
  const index = link.stack.layers.findIndex((layer) => layer.number === link.number);
  return index === -1 ? null : { position: index + 1, size: link.stack.layers.length };
}
