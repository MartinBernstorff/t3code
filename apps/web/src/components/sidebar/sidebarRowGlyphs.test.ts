import type { SidebarRowGlyphKind } from "@t3tools/contracts/settings";
import type { ThreadPriority } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveSidebarRowGlyphs } from "./sidebarRowGlyphs";

const ALL: ReadonlyArray<SidebarRowGlyphKind> = ["waitingOnOthers", "priority"];

describe("resolveSidebarRowGlyphs", () => {
  it.each<{
    name: string;
    priority: ThreadPriority | null;
    waitingOnOthers: boolean;
    enabled: ReadonlyArray<SidebarRowGlyphKind>;
    expected: ReadonlyArray<string>;
  }>([
    {
      name: "shows set glyphs in canonical order",
      priority: "high",
      waitingOnOthers: true,
      enabled: ALL,
      expected: ["priority", "waitingOnOthers"],
    },
    {
      name: "hides disabled kinds",
      priority: "urgent",
      waitingOnOthers: true,
      enabled: ["waitingOnOthers"],
      expected: ["waitingOnOthers"],
    },
    {
      name: "skips unset fields",
      priority: null,
      waitingOnOthers: false,
      enabled: ALL,
      expected: [],
    },
  ])("$name", ({ priority, waitingOnOthers, enabled, expected }) => {
    expect(
      resolveSidebarRowGlyphs({ priority, waitingOnOthers }, enabled).map((glyph) => glyph.kind),
    ).toEqual(expected);
  });
});
