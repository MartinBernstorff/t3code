import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  MessageId,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TrimmedString,
} from "./baseSchemas.ts";

export const OrchestrationThreadSearchSource = Schema.Literals(["user", "assistant"]);
export type OrchestrationThreadSearchSource = typeof OrchestrationThreadSearchSource.Type;

/** Longer queries are cut to this before they are sent. */
export const THREAD_SEARCH_QUERY_MAX_LENGTH = 200;

// The server's SQLite client is synchronous and single-connection. Bound both
// scan input and response size so a search cannot monopolize that connection.
export const OrchestrationSearchThreadsInput = Schema.Struct({
  query: TrimmedString.check(
    Schema.isMinLength(2),
    Schema.isMaxLength(THREAD_SEARCH_QUERY_MAX_LENGTH),
  ),
  limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 }))),
});
export type OrchestrationSearchThreadsInput = typeof OrchestrationSearchThreadsInput.Type;

export const OrchestrationThreadSearchMatch = Schema.Struct({
  threadId: ThreadId,
  projectId: ProjectId,
  source: OrchestrationThreadSearchSource,
  snippet: Schema.String.check(Schema.isMaxLength(240)),
  messageCreatedAt: Schema.NullOr(IsoDateTime),
  /**
   * How well the message matches: 1 for whole words, 0.8 when a word only
   * starts one, 0.3 when one only appears inside words, 0.25 more when the
   * words are written together as typed, else 0.1 more when they are near.
   * Older servers omit it.
   */
  quality: Schema.optionalKey(Schema.Finite),
  /** How many of the thread's newest messages match. Older servers omit it. */
  hits: Schema.optionalKey(Schema.Int),
  /** The message the snippet is from. Older servers omit it. */
  messageId: Schema.optionalKey(MessageId),
});
export type OrchestrationThreadSearchMatch = typeof OrchestrationThreadSearchMatch.Type;

export const OrchestrationSearchThreadsResult = Schema.Struct({
  matches: Schema.Array(OrchestrationThreadSearchMatch),
});
export type OrchestrationSearchThreadsResult = typeof OrchestrationSearchThreadsResult.Type;

export class OrchestrationSearchThreadsError extends Schema.TaggedError<OrchestrationSearchThreadsError>()(
  "OrchestrationSearchThreadsError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export const THREAD_MESSAGE_LOG_PAGE_MAX = 500;

/** An ISO 8601 time with a date part, in any offset; the server compares it as UTC. */
const IsoInstant = Schema.String.check(
  Schema.makeFilter(
    (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)),
    { expected: "an ISO 8601 time, such as 2026-11-10T00:00:00Z" },
  ),
);

/** Who sent a user-role message: the user, or an agent or the server on their behalf. */
export const OrchestrationThreadMessageCreatedBy = Schema.Literals(["user", "agent"]);
export type OrchestrationThreadMessageCreatedBy = typeof OrchestrationThreadMessageCreatedBy.Type;

/**
 * User-role messages sent in `[since, until)`, oldest first, for tools that
 * log when work happened. Pages are bounded for the same reason as search.
 */
export const OrchestrationThreadMessageLogInput = Schema.Struct({
  since: IsoInstant,
  until: IsoInstant,
  /** Omitted means every project. */
  projectIds: Schema.optionalKey(Schema.Array(ProjectId)),
  /** Omitted means both. */
  createdBy: Schema.optionalKey(OrchestrationThreadMessageCreatedBy),
  /** The previous page's `nextCursor`. */
  cursor: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: THREAD_MESSAGE_LOG_PAGE_MAX })),
  ),
});
export type OrchestrationThreadMessageLogInput = typeof OrchestrationThreadMessageLogInput.Type;

export const OrchestrationThreadMessageLogEntry = Schema.Struct({
  messageId: MessageId,
  threadId: ThreadId,
  threadTitle: Schema.String,
  projectId: ProjectId,
  /** Null when the thread's project record is gone. */
  projectRoot: Schema.NullOr(Schema.String),
  createdAt: IsoDateTime,
  createdBy: OrchestrationThreadMessageCreatedBy,
  /** Such as `web`, `provider`, `server` or `mcp`. Null for messages older than the field. */
  creationSource: Schema.NullOr(Schema.String),
});
export type OrchestrationThreadMessageLogEntry = typeof OrchestrationThreadMessageLogEntry.Type;

export const OrchestrationThreadMessageLogResult = Schema.Struct({
  messages: Schema.Array(OrchestrationThreadMessageLogEntry),
  /** Null on the last page. */
  nextCursor: Schema.NullOr(Schema.String),
});
export type OrchestrationThreadMessageLogResult = typeof OrchestrationThreadMessageLogResult.Type;
