import * as Schema from "effect/Schema";

export const ThreadPriority = Schema.Literals(["urgent", "high", "medium", "low"]);
export type ThreadPriority = typeof ThreadPriority.Type;
