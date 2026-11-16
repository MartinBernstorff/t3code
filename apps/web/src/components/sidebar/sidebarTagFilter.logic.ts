import {
  MAX_THREAD_TAG_FILTER_PRESETS,
  type ThreadTagFilter,
  type ThreadTagFilterPreset,
} from "@t3tools/contracts";

export type ThreadTagMode = "required" | "hidden";

export function threadTagMode(filter: ThreadTagFilter, tag: string): ThreadTagMode | null {
  if (filter.required.includes(tag)) return "required";
  if (filter.hidden.includes(tag)) return "hidden";
  return null;
}

/** Gives the tag this mode, or clears it when it already has it. A tag holds one mode at a time. */
export function toggleThreadTagMode(
  filter: ThreadTagFilter,
  tag: string,
  mode: ThreadTagMode,
): ThreadTagFilter {
  const required = filter.required.filter((candidate) => candidate !== tag);
  const hidden = filter.hidden.filter((candidate) => candidate !== tag);
  if (threadTagMode(filter, tag) === mode) return { required, hidden };
  return mode === "required"
    ? { required: [...required, tag], hidden }
    : { required, hidden: [...hidden, tag] };
}

const sameTags = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  left.length === right.length && left.every((tag) => right.includes(tag));

/** The preset the filter equals, ignoring tag order. */
export function matchingThreadTagPreset(
  presets: ReadonlyArray<ThreadTagFilterPreset>,
  filter: ThreadTagFilter,
): ThreadTagFilterPreset | undefined {
  return presets.find(
    (preset) =>
      sameTags(preset.required, filter.required) && sameTags(preset.hidden, filter.hidden),
  );
}

/** Saving under an existing name replaces that preset. Null when the list is full. */
export function saveThreadTagPreset(
  presets: ReadonlyArray<ThreadTagFilterPreset>,
  name: string,
  filter: ThreadTagFilter,
): ReadonlyArray<ThreadTagFilterPreset> | null {
  const preset = { name, required: filter.required, hidden: filter.hidden };
  if (presets.some((candidate) => candidate.name === name)) {
    return presets.map((candidate) => (candidate.name === name ? preset : candidate));
  }
  return presets.length >= MAX_THREAD_TAG_FILTER_PRESETS ? null : [...presets, preset];
}
