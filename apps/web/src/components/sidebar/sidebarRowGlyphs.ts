import { SidebarRowGlyphKind } from "@t3tools/contracts/settings";
import type { ThreadPriority } from "@t3tools/contracts";

export type SidebarRowGlyph =
  | { readonly kind: "priority"; readonly priority: ThreadPriority }
  | { readonly kind: "waitingOnOthers" };

export const SIDEBAR_ROW_GLYPH_LABELS: Record<SidebarRowGlyphKind, string> = {
  priority: "Priority",
  waitingOnOthers: "Waiting on others",
};

/** Glyphs to draw before the title, in canonical kind order regardless of setting order. */
export function resolveSidebarRowGlyphs(
  thread: { readonly priority: ThreadPriority | null; readonly waitingOnOthers: boolean },
  enabledKinds: ReadonlyArray<SidebarRowGlyphKind>,
): ReadonlyArray<SidebarRowGlyph> {
  const glyphs: SidebarRowGlyph[] = [];
  for (const kind of SidebarRowGlyphKind.literals) {
    if (!enabledKinds.includes(kind)) continue;
    switch (kind) {
      case "priority":
        if (thread.priority) glyphs.push({ kind, priority: thread.priority });
        break;
      case "waitingOnOthers":
        if (thread.waitingOnOthers) glyphs.push({ kind });
        break;
    }
  }
  return glyphs;
}

export function toggleSidebarRowGlyphKind(
  enabledKinds: ReadonlyArray<SidebarRowGlyphKind>,
  kind: SidebarRowGlyphKind,
  visible: boolean,
): ReadonlyArray<SidebarRowGlyphKind> {
  const without = enabledKinds.filter((enabled) => enabled !== kind);
  return visible ? [...without, kind] : without;
}
