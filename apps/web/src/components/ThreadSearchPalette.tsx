import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";

import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { useBoringSidebarEnabled, useClientSettings } from "../hooks/useSettings";
import { useThreadRouteRef } from "../hooks/useThreadRouteTarget";
import { useVisibleThreadShells } from "../state/entities";
import { primaryServerKeybindingsAtom } from "../state/server";
import { CommandPaletteContent } from "./CommandPaletteContent";
import { useProjectLookups } from "./CommandPaletteLookups";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { useCommandPaletteThreadItems } from "./CommandPaletteThreadItems";
import { sidebarInboxReturns } from "./sidebar/inboxReturns";
import { searchThreadsForPalette } from "./ThreadSearchPalette.logic";

export function ThreadSearchPalette(props: { readonly setOpen: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [highlightedItemValue, setHighlightedItemValue] = useState<string | null>(null);
  // Sections depend on the clock (snooze wakes); fixed at open so rows do not move.
  const [now] = useState(() => new Date().toISOString());
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const threads = useVisibleThreadShells();
  const threadSort = useClientSettings((settings) => settings.sidebarThreadSort);
  const threadSortOverrides = useClientSettings((settings) => settings.sidebarThreadSortOverrides);
  const groupBy = useClientSettings((settings) => settings.sidebarGroupBy);
  const workingShelfEnabled = useClientSettings((settings) => settings.sidebarWorkingShelfEnabled);
  const boringSidebar = useBoringSidebarEnabled();
  const projectGroups = useSidebarProjectGroups();
  const { projectByKey } = useProjectLookups();
  const routeThreadRef = useThreadRouteRef();
  const { threadItems } = useCommandPaletteThreadItems({
    activeThread: routeThreadRef
      ? { environmentId: routeThreadRef.environmentId, id: routeThreadRef.threadId }
      : null,
    threadSearchQuery: "",
  });
  const itemByValue = new Map(threadItems.map((item) => [item.value, item]));
  const groups = searchThreadsForPalette({
    threads,
    query,
    projectTitleOf: (thread) =>
      projectByKey.get(`${thread.environmentId}:${thread.projectId}`)?.title ?? null,
    now,
    layout: {
      groupBy,
      threadSort,
      threadSortOverrides,
      workingShelfEnabled,
      boringSidebar,
      projects: projectGroups,
      inbox: sidebarInboxReturns,
    },
  }).flatMap((group) => {
    const items = group.threads.flatMap(
      (thread) => itemByValue.get(`thread:${thread.environmentId}:${thread.id}`) ?? [],
    );
    return items.length === 0 ? [] : [{ value: group.key, label: group.label, items }];
  });
  // Typing clears our highlight while Base UI keeps the first row highlighted, and Enter opens it.
  const displayedHighlight = highlightedItemValue ?? groups[0]?.items[0]?.value ?? null;

  return (
    <CommandPaletteContent
      aria-label="Search threads"
      autoHighlight="always"
      footerActionLabel="Open thread"
      inputProps={{ placeholder: "Search threads by title, project, or PR…" }}
      mode="none"
      onItemHighlighted={(value) => {
        setHighlightedItemValue(typeof value === "string" ? value : null);
      }}
      onValueChange={(value) => {
        setHighlightedItemValue(null);
        setQuery(value);
      }}
      panelSize="tall-list"
      testId="thread-search-palette"
      value={query}
    >
      <CommandPaletteResults
        groups={groups}
        highlightedItemValue={displayedHighlight}
        isActionsOnly={false}
        keybindings={keybindings}
        onExecuteItem={(item) => {
          if (item.kind !== "action") return;
          props.setOpen(false);
          void item.run();
        }}
        emptyStateMessage={query.trim().length > 0 ? "No matching threads." : "No threads yet."}
      />
    </CommandPaletteContent>
  );
}
