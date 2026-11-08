import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { selectProjectGroupingSettings } from "@t3tools/client-runtime/state/project-grouping";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { threadWokeAt } from "@t3tools/client-runtime/state/thread-settled";
import { useState } from "react";

import { useUiStateStore } from "../uiStateStore";

import { useSidebarProjectGroups } from "../hooks/useSidebarProjectGroups";
import { useBoringSidebarEnabled, useClientSettings } from "../hooks/useSettings";
import { useThreadRouteRef } from "../hooks/useThreadRouteTarget";
import { useServerConfigs, useVisibleThreadShells } from "../state/entities";
import {
  projectGroupsSpanEnvironments,
  resolveSidebarProjectScopeKeys,
} from "../sidebarProjectGrouping";
import { cn } from "~/lib/utils";
import {
  useEnvironmentIdentities,
  useEnvironmentMachines,
  usePrimaryEnvironmentId,
} from "../state/environments";
import { primaryServerKeybindingsAtom } from "../state/server";
import { CommandPaletteContent } from "./CommandPaletteContent";
import { useProjectLookups } from "./CommandPaletteLookups";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { useCommandPaletteThreadItems } from "./CommandPaletteThreadItems";
import { sidebarInboxReturns } from "./sidebar/inboxReturns";
import { sidebarTokenClassName } from "./sidebar/SidebarCountTokens";
import {
  EMPTY_PROVIDER_ENTRIES,
  sidebarProviderEntriesAtom,
} from "./sidebar/sidebarProviderEntries";
import { SidebarThreadCardPreview } from "./sidebar/SidebarThreadRow";
import { resolveSidebarThreadRowVisibility } from "./sidebar/sidebarThreadRowItems";
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
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const persistedProjectScopeKeys = useUiStateStore((store) => store.sidebarProjectScopeKeys);
  // The sidebar's project filter, read the way the sidebar reads it; archived projects mean all.
  const projectScopeKeys = resolveSidebarProjectScopeKeys({
    groups: projectGroups,
    keys: persistedProjectScopeKeys,
    settings: projectGroupingSettings,
  });
  const scopedProjectGroups = projectGroups.filter(
    (group) => !group.archived && projectScopeKeys.includes(group.projectKey),
  );
  const scopedProjectKeys =
    scopedProjectGroups.length === 0
      ? null
      : new Set(
          scopedProjectGroups.flatMap((group) =>
            group.memberProjectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`),
          ),
        );
  const routeThreadRef = useThreadRouteRef();
  const tokenColor = useClientSettings((settings) => settings.sidebarTokenColor);
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);
  const visibleItems = useClientSettings(resolveSidebarThreadRowVisibility);
  const providerEntriesByEnvironment = useAtomValue(sidebarProviderEntriesAtom);
  const environmentMachineById = useEnvironmentMachines();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentLabelById = new Map(
    useEnvironmentIdentities().map((environment) => [environment.environmentId, environment.label]),
  );
  const projectDisplayNameByKey = new Map(
    projectGroups.flatMap((group) =>
      group.memberProjects.map((project) => [
        `${project.environmentId}:${project.id}`,
        group.displayName,
      ]),
    ),
  );
  const serverConfigs = useServerConfigs();
  const showProjectEnvironments = projectGroupsSpanEnvironments(projectGroups);
  const routeThreadKey = routeThreadRef ? scopedThreadKey(routeThreadRef) : null;
  const { threadItems } = useCommandPaletteThreadItems({
    activeThread: routeThreadRef
      ? {
          environmentId: routeThreadRef.environmentId,
          id: routeThreadRef.threadId,
        }
      : null,
    threadSearchQuery: "",
  });
  const itemByValue = new Map(threadItems.map((item) => [item.value, item]));
  const threadGroups = searchThreadsForPalette({
    threads,
    query,
    scopedProjectKeys,
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
    const rows = group.threads.flatMap((thread) => {
      const item = itemByValue.get(`thread:${thread.environmentId}:${thread.id}`);
      return item ? [{ thread, item }] : [];
    });
    return rows.length === 0 ? [] : [{ value: group.key, label: group.label, rows }];
  });
  // Typing clears our highlight while Base UI keeps the first row highlighted, and Enter opens it.
  const displayedHighlight = highlightedItemValue ?? threadGroups[0]?.rows[0]?.item.value ?? null;
  const groups = threadGroups.map((group) => ({
    value: group.value,
    label: group.label,
    items: group.rows.map(({ thread, item }) => {
      const projectKey = `${thread.environmentId}:${thread.projectId}`;
      const project = projectByKey.get(projectKey) ?? null;
      const environmentLabel = environmentLabelById.get(thread.environmentId) ?? null;
      // The sidebar shows a scratch thread's machine where its branch would go.
      const scratchMachineLabel =
        showProjectEnvironments &&
        project !== null &&
        isScratchProject(project, serverConfigs.get(thread.environmentId)?.scratchWorkspaceRoot)
          ? environmentLabel
          : null;
      return {
        ...item,
        icon: (
          <span
            aria-hidden
            className={cn(
              "my-1.5 w-1 shrink-0 self-stretch rounded-full",
              sidebarTokenClassName(thread, tokenColor),
            )}
          />
        ),
        // The highlighted row takes the sidebar's active card look.
        content: (
          <SidebarThreadCardPreview
            thread={thread}
            isActive={item.value === displayedHighlight}
            isRouteThread={
              scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) === routeThreadKey
            }
            wokeAt={threadWokeAt(thread, { now })}
            currentEnvironmentId={primaryEnvironmentId}
            environmentLabel={environmentLabel}
            environmentMachine={environmentMachineById.get(thread.environmentId) ?? "server"}
            scratchMachineLabel={scratchMachineLabel}
            project={project}
            projectDisplayName={projectDisplayNameByKey.get(projectKey) ?? null}
            providerEntryByInstanceId={
              providerEntriesByEnvironment.get(thread.environmentId) ?? EMPTY_PROVIDER_ENTRIES
            }
            timestampFormat={timestampFormat}
            visibleItems={visibleItems}
          />
        ),
      };
    }),
  }));

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
