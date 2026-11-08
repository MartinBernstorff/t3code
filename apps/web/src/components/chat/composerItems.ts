import type { ClientSettings } from "@t3tools/contracts";

// Ids are stored in client settings, so never rename one.
export const COMPOSER_ITEMS = [
  { id: "attach", label: "Attach button", defaultVisible: true },
  { id: "model", label: "Model and effort picker", defaultVisible: true },
  { id: "permissions", label: "Permissions", defaultVisible: true },
  { id: "context", label: "Context window", defaultVisible: false },
  { id: "dictation", label: "Dictation", defaultVisible: true },
] as const;

type ComposerItemId = (typeof COMPOSER_ITEMS)[number]["id"];
type ComposerVisibility = Readonly<Record<ComposerItemId, boolean>>;

type ComposerItem = (typeof COMPOSER_ITEMS)[number];
type ComposerItemSettings = Pick<ClientSettings, "composerItems" | "contextWindowMeterEnabled">;

// People who turned on the retired context window toggle keep the meter until they change it here.
function defaultVisible(item: ComposerItem, settings: ComposerItemSettings) {
  return item.id === "context" ? settings.contextWindowMeterEnabled : item.defaultVisible;
}

export function resolveComposerVisibility(settings: ComposerItemSettings): ComposerVisibility {
  return Object.fromEntries(
    COMPOSER_ITEMS.map((item) => [
      item.id,
      settings.composerItems[item.id] ?? defaultVisible(item, settings),
    ]),
  ) as Record<ComposerItemId, boolean>;
}

/** Stores only choices that differ from the default, so a later default change reaches everyone else. */
export function setComposerItem(
  settings: ComposerItemSettings,
  item: ComposerItem,
  visible: boolean,
): ClientSettings["composerItems"] {
  const { [item.id]: _previous, ...rest } = settings.composerItems;
  return visible === defaultVisible(item, settings) ? rest : { ...rest, [item.id]: visible };
}

export function isDefaultComposerVisibility(visibility: ComposerVisibility) {
  return COMPOSER_ITEMS.every((item) => visibility[item.id] === item.defaultVisible);
}

/** Also clears the retired context window flag, so the meter returns to off. */
export const RESET_COMPOSER_ITEMS = {
  composerItems: {},
  contextWindowMeterEnabled: false,
} satisfies Partial<ClientSettings>;
