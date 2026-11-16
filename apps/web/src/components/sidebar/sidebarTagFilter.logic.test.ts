import { MAX_THREAD_TAG_FILTER_PRESETS } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  matchingThreadTagPreset,
  saveThreadTagPreset,
  toggleThreadTagMode,
} from "./sidebarTagFilter.logic";

describe("toggleThreadTagMode", () => {
  it("moves a tag between modes and clears it when toggled again", () => {
    const required = toggleThreadTagMode(
      { required: [], hidden: ["review"] },
      "review",
      "required",
    );
    expect(required).toEqual({ required: ["review"], hidden: [] });
    expect(toggleThreadTagMode(required, "review", "required")).toEqual({
      required: [],
      hidden: [],
    });
  });
});

describe("matchingThreadTagPreset", () => {
  it("matches regardless of tag order but not a subset", () => {
    const preset = { name: "Batch", required: ["review", "web"], hidden: ["wip"] };
    expect(
      matchingThreadTagPreset([preset], { required: ["web", "review"], hidden: ["wip"] }),
    ).toBe(preset);
    expect(
      matchingThreadTagPreset([preset], { required: ["review"], hidden: ["wip"] }),
    ).toBeUndefined();
  });
});

describe("saveThreadTagPreset", () => {
  it("replaces a preset of the same name and refuses a new one when full", () => {
    const filter = { required: ["review"], hidden: [] };
    expect(
      saveThreadTagPreset([{ name: "Batch", required: [], hidden: ["wip"] }], "Batch", filter),
    ).toEqual([{ name: "Batch", ...filter }]);
    const full = Array.from({ length: MAX_THREAD_TAG_FILTER_PRESETS }, (_, index) => ({
      name: `Preset ${index}`,
      ...filter,
    }));
    expect(saveThreadTagPreset(full, "Another", filter)).toBeNull();
  });
});
