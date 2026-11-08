import { describe, expect, it } from "vite-plus/test";

import { COMPOSER_ITEMS, resolveComposerVisibility, setComposerItem } from "./composerItems";

const context = COMPOSER_ITEMS.find((item) => item.id === "context")!;
const model = COMPOSER_ITEMS.find((item) => item.id === "model")!;

describe("composer items", () => {
  it.each([
    { legacy: false, items: {}, context: false, model: true },
    { legacy: true, items: {}, context: true, model: true },
    { legacy: true, items: { context: false }, context: false, model: true },
    { legacy: false, items: { model: false, retired: true }, context: false, model: false },
  ])("resolves from overrides and the retired context flag: %o", (row) => {
    const visibility = resolveComposerVisibility({
      composerItems: row.items,
      contextWindowMeterEnabled: row.legacy,
    });
    expect(visibility.context).toBe(row.context);
    expect(visibility.model).toBe(row.model);
    expect(visibility.attach).toBe(true);
  });

  it("stores only choices that differ from the default", () => {
    const legacyOn = { composerItems: {}, contextWindowMeterEnabled: true };
    expect(setComposerItem(legacyOn, context, false)).toEqual({ context: false });
    expect(setComposerItem(legacyOn, context, true)).toEqual({});

    const hidden = { composerItems: { model: false }, contextWindowMeterEnabled: false };
    expect(setComposerItem(hidden, model, true)).toEqual({});
  });
});
