import { LinearIssueId, linearIssueUrl, LinearWorkspaceSlug } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const isLinearIssueId = Schema.is(LinearIssueId);
const isLinearWorkspaceSlug = Schema.is(LinearWorkspaceSlug);

/**
 * Reads an issue id (`mb-123`) or a pasted Linear issue URL. Empty input is null (unlink);
 * anything else unreadable is undefined.
 */
export function parseLinearIssueInput(text: string): LinearIssueId | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const fromUrl = /\/issue\/([^/?#]+)/.exec(trimmed)?.[1];
  const candidate = (fromUrl ?? trimmed).toUpperCase();
  return isLinearIssueId(candidate) ? candidate : undefined;
}

/** Reads a workspace slug or any pasted `linear.app/<slug>/...` URL, like the issue parser. */
export function parseLinearWorkspaceInput(text: string): LinearWorkspaceSlug | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const fromUrl = /linear\.app\/([^/?#]+)/.exec(trimmed)?.[1];
  const candidate = (fromUrl ?? trimmed).toLowerCase();
  return isLinearWorkspaceSlug(candidate) ? candidate : undefined;
}

/** The issue's Linear URL, or null when the project has no Linear workspace. */
export function linearIssueHref(
  slug: LinearWorkspaceSlug | null | undefined,
  issueId: LinearIssueId,
): string | null {
  return slug ? linearIssueUrl(slug, issueId) : null;
}
