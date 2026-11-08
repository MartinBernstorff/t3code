import * as Schema from "effect/Schema";

/** Absent on a thread means inbox. */
export const ThreadEngagement = Schema.Literals(["engaged", "inbox", "queued"]);
export type ThreadEngagement = typeof ThreadEngagement.Type;
