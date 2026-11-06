import { describe, expect, it } from "vite-plus/test";

import { resolveSidebarRowGlyphs } from "./sidebarRowGlyphs";

describe("resolveSidebarRowGlyphs", () => {
  it.each([
    [
      "shows priority when enabled",
      { priority: "high" as const },
      ["priority" as const],
      [{ kind: "priority", priority: "high" }],
    ],
    ["hides priority when disabled", { priority: "urgent" as const }, [], []],
    ["shows nothing for a thread without priority", { priority: null }, ["priority" as const], []],
  ])("%s", (_name, thread, enabled, expected) => {
    expect(resolveSidebarRowGlyphs(thread, enabled)).toEqual(expected);
  });
});
