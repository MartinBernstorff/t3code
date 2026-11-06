import * as Schema from "effect/Schema";

/** A Linear issue identifier: team key, dash, number (`MB-123`). */
export const LinearIssueId = Schema.String.check(
  Schema.isMaxLength(32),
  Schema.isPattern(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/),
);
export type LinearIssueId = typeof LinearIssueId.Type;

/** The workspace part of `linear.app/<slug>/...`. */
export const LinearWorkspaceSlug = Schema.String.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/),
);
export type LinearWorkspaceSlug = typeof LinearWorkspaceSlug.Type;

export function linearIssueUrl(slug: LinearWorkspaceSlug, issueId: LinearIssueId): string {
  return `https://linear.app/${slug}/issue/${issueId}`;
}
