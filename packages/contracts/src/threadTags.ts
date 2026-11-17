import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Tags match by exact spelling and case after trimming. */
export const ThreadTag = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.makeFilter((value) =>
    /[\p{Cc}]/u.test(value) ? "A thread tag must be a single line of text." : true,
  ),
);
export type ThreadTag = typeof ThreadTag.Type;

/** Tags read back from storage or a peer. Lenient so a later tag rule never fails a whole thread. */
export const StoredThreadTags = Schema.Array(Schema.String).pipe(
  Schema.catchDecoding(() => Effect.succeedSome([])),
);

/** The sidebar lists a thread only when it has every `required` tag and no `hidden` tag. */
export const ThreadTagFilter = Schema.Struct({
  required: Schema.Array(ThreadTag),
  hidden: Schema.Array(ThreadTag),
});
export type ThreadTagFilter = typeof ThreadTagFilter.Type;

export const EMPTY_THREAD_TAG_FILTER: ThreadTagFilter = { required: [], hidden: [] };

export const MAX_THREAD_TAG_FILTER_PRESETS = 20;

export const ThreadTagFilterPreset = Schema.Struct({
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(64)),
  /** A client icon name. Unknown names fall back to the default icon instead of failing the presets. */
  icon: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(64))),
  ...ThreadTagFilter.fields,
});
export type ThreadTagFilterPreset = typeof ThreadTagFilterPreset.Type;

export const ThreadTagFilterPresets = Schema.Array(ThreadTagFilterPreset).check(
  Schema.isMaxLength(MAX_THREAD_TAG_FILTER_PRESETS),
);
