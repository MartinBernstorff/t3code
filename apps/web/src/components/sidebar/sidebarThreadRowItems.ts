import type { ClientSettings } from "@t3tools/contracts";

// Ids are stored in client settings, so never rename one.
export const SIDEBAR_THREAD_ROW_ITEMS = [
  { id: "projectIcon", label: "Project icon" },
  { id: "projectName", label: "Project name" },
  { id: "branch", label: "Branch" },
  { id: "pullRequest", label: "Pull request" },
  { id: "linearIssue", label: "Linear issue" },
  { id: "diff", label: "Changed lines" },
  { id: "terminals", label: "Running terminals" },
  { id: "machine", label: "Machine" },
  { id: "provider", label: "Provider and model" },
  { id: "time", label: "Last activity time" },
] as const;

type SidebarThreadRowItem = (typeof SIDEBAR_THREAD_ROW_ITEMS)[number];
export type SidebarThreadRowItemId = SidebarThreadRowItem["id"];
export type SidebarThreadRowVisibility = Readonly<Record<SidebarThreadRowItemId, boolean>>;
type SidebarThreadRowItemSettings = Pick<ClientSettings, "sidebarThreadRowItems">;

export function resolveSidebarThreadRowVisibility(
  settings: SidebarThreadRowItemSettings,
): SidebarThreadRowVisibility {
  return Object.fromEntries(
    SIDEBAR_THREAD_ROW_ITEMS.map((item) => [
      item.id,
      settings.sidebarThreadRowItems[item.id] ?? true,
    ]),
  ) as Record<SidebarThreadRowItemId, boolean>;
}

/** Stores only hidden items, so a part added later shows for everyone. */
export function setSidebarThreadRowItem(
  settings: SidebarThreadRowItemSettings,
  item: SidebarThreadRowItem,
  visible: boolean,
): ClientSettings["sidebarThreadRowItems"] {
  const { [item.id]: _previous, ...rest } = settings.sidebarThreadRowItems;
  return visible ? rest : { ...rest, [item.id]: false };
}

export function isDefaultSidebarThreadRowVisibility(visibility: SidebarThreadRowVisibility) {
  return SIDEBAR_THREAD_ROW_ITEMS.every((item) => visibility[item.id]);
}
