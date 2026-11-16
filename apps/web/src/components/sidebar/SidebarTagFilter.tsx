import {
  EMPTY_THREAD_TAG_FILTER,
  ThreadTag,
  type ThreadTagFilter,
  type ThreadTagFilterPreset,
} from "@t3tools/contracts";
import { BookmarkIcon, CheckIcon, MinusIcon, PlusIcon, TagIcon, XIcon } from "lucide-react";
import * as Schema from "effect/Schema";
import { type ReactNode, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
  ComboboxTrigger,
} from "../ui/combobox";
import { Input } from "../ui/input";
import { toastManager } from "../ui/toast";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import {
  matchingThreadTagPreset,
  saveThreadTagPreset,
  threadTagMode,
  toggleThreadTagMode,
  type ThreadTagMode,
} from "./sidebarTagFilter.logic";

type TagFilterItem =
  | {
      readonly kind: "preset";
      readonly value: string;
      readonly label: string;
      readonly preset: ThreadTagFilterPreset;
    }
  | {
      readonly kind: "tag";
      readonly value: string;
      readonly label: string;
      readonly count: number | null;
    };

const isThreadTag = Schema.is(ThreadTag);

function hasShift(event: Event | undefined): boolean {
  return event !== undefined && "shiftKey" in event && event.shiftKey === true;
}

function BadgedIcon(props: {
  badge: "required" | "hidden" | "applied" | null;
  children: ReactNode;
}) {
  const Glyph =
    props.badge === "required" ? PlusIcon : props.badge === "hidden" ? MinusIcon : CheckIcon;
  return (
    <span className="relative flex shrink-0">
      {props.children}
      {props.badge === null ? null : (
        <span
          className={
            props.badge === "hidden"
              ? "pointer-events-none absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-destructive ring-2 ring-popover"
              : "pointer-events-none absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-primary ring-2 ring-popover"
          }
        >
          <Glyph className="size-2 text-white" strokeWidth={4} aria-hidden />
        </span>
      )}
    </span>
  );
}

function TagModeButton(props: {
  mode: ThreadTagMode;
  active: boolean;
  tag: string;
  onToggle: (mode: ThreadTagMode) => void;
}) {
  const label = props.mode === "required" ? "Require" : "Hide";
  return (
    <Button
      size="xs"
      variant={props.active ? "secondary" : "ghost-muted"}
      tabIndex={-1}
      aria-pressed={props.active}
      title={`${label} threads tagged ${props.tag}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onToggle(props.mode);
      }}
    >
      {label}
    </Button>
  );
}

export function SidebarTagFilterMenu(props: {
  filter: ThreadTagFilter;
  presets: ReadonlyArray<ThreadTagFilterPreset>;
  /** Thread counts for each tag the listed threads carry. */
  tagCounts: ReadonlyMap<string, number>;
  onFilterChange: (filter: ThreadTagFilter) => void;
  onPresetsChange: (presets: ReadonlyArray<ThreadTagFilterPreset>) => void;
}) {
  const { filter, presets, tagCounts, onFilterChange, onPresetsChange } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activePreset = matchingThreadTagPreset(presets, filter);
  const activeCount = filter.required.length + filter.hidden.length;

  const knownTags = [
    ...new Set([...tagCounts.keys(), ...filter.required, ...filter.hidden]),
  ].toSorted((left, right) => left.localeCompare(right));
  const items: TagFilterItem[] = [
    ...presets.map((preset) => ({
      kind: "preset" as const,
      value: `preset:${preset.name}`,
      label: preset.name,
      preset,
    })),
    ...knownTags.map((tag) => ({
      kind: "tag" as const,
      value: `tag:${tag}`,
      label: tag,
      count: tagCounts.get(tag) ?? 0,
    })),
  ];
  const needle = query.trim();
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(needle.toLowerCase()),
  );
  // A typed tag no thread has yet can still be required or hidden ahead of time.
  if (needle !== "" && isThreadTag(needle) && !knownTags.includes(needle)) {
    filteredItems.push({ kind: "tag", value: `tag:${needle}`, label: needle, count: null });
  }

  const toggleTag = (tag: string, mode: ThreadTagMode) =>
    onFilterChange(toggleThreadTagMode(filter, tag, mode));
  const applyPreset = (preset: ThreadTagFilterPreset) =>
    onFilterChange(
      activePreset === preset
        ? EMPTY_THREAD_TAG_FILTER
        : { required: preset.required, hidden: preset.hidden },
    );

  return (
    <Combobox<TagFilterItem>
      items={items}
      filteredItems={filteredItems}
      autoHighlight
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(left, right) => left.value === right.value}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      value={null}
      onValueChange={(item, eventDetails) => {
        // Canceling keeps the menu open and the query intact, as the project picker does.
        eventDetails.cancel();
        if (item === null) return;
        if (item.kind === "preset") applyPreset(item.preset);
        else toggleTag(item.label, hasShift(eventDetails.event) ? "hidden" : "required");
      }}
    >
      <ComboboxTrigger
        render={
          <SidebarHeaderIconButton
            label={
              activeCount === 0
                ? "Filter threads by tag"
                : `Filter threads by tag: ${activePreset?.name ?? `${activeCount} active`}`
            }
          />
        }
      >
        <BadgedIcon badge={activeCount > 0 ? "applied" : null}>
          <TagIcon className="size-4" />
        </BadgedIcon>
      </ComboboxTrigger>
      <ComboboxPopup
        align="start"
        collisionAvoidance={{ side: "flip", align: "shift" }}
        className="w-[min(20rem,var(--available-width))] overflow-hidden"
        finalFocus={(closeType) => closeType === "keyboard"}
      >
        <ComboboxSearchInput
          aria-label="Search presets and tags"
          placeholder="Search or add tags..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ComboboxEmpty>No matching presets or tags.</ComboboxEmpty>
        <ComboboxList>
          {(item: TagFilterItem) => {
            if (item.kind === "preset") {
              const applied = activePreset === item.preset;
              return (
                <ComboboxItem
                  key={item.value}
                  hideIndicator
                  selectedFill={false}
                  value={item}
                  aria-selected={applied}
                >
                  <BadgedIcon badge={applied ? "applied" : null}>
                    <BookmarkIcon className="size-4" />
                  </BadgedIcon>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                  <span className="min-w-0 truncate text-muted-foreground text-xs">
                    {[
                      ...item.preset.required.map((tag) => `+${tag}`),
                      ...item.preset.hidden.map((tag) => `−${tag}`),
                    ].join(" ")}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost-muted"
                    tabIndex={-1}
                    title={`Delete preset ${item.label}`}
                    aria-label={`Delete preset ${item.label}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onPresetsChange(presets.filter((preset) => preset !== item.preset));
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </ComboboxItem>
              );
            }
            const mode = threadTagMode(filter, item.label);
            return (
              <ComboboxItem
                key={item.value}
                hideIndicator
                selectedFill={false}
                value={item}
                aria-selected={mode !== null}
              >
                <BadgedIcon badge={mode}>
                  <TagIcon className="size-4" />
                </BadgedIcon>
                <span
                  className={
                    mode === "hidden"
                      ? "min-w-0 flex-1 truncate text-muted-foreground text-sm line-through"
                      : "min-w-0 flex-1 truncate text-sm"
                  }
                >
                  {item.label}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {item.count === null ? "new" : item.count}
                </span>
                <TagModeButton
                  mode="required"
                  active={mode === "required"}
                  tag={item.label}
                  onToggle={(next) => toggleTag(item.label, next)}
                />
                <TagModeButton
                  mode="hidden"
                  active={mode === "hidden"}
                  tag={item.label}
                  onToggle={(next) => toggleTag(item.label, next)}
                />
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <div className="border-border/70 border-t px-3 py-1.5 text-muted-foreground text-xs">
          Enter requires a tag, Shift+Enter hides it.
        </div>
      </ComboboxPopup>
    </Combobox>
  );
}

/** What the tag filter does to the list, and the way out of it. Renders nothing while off. */
export function SidebarTagFilterBar(props: {
  filter: ThreadTagFilter;
  presets: ReadonlyArray<ThreadTagFilterPreset>;
  hiddenCount: number;
  onFilterChange: (filter: ThreadTagFilter) => void;
  onPresetsChange: (presets: ReadonlyArray<ThreadTagFilterPreset>) => void;
}) {
  const { filter, presets, hiddenCount, onFilterChange, onPresetsChange } = props;
  const [presetName, setPresetName] = useState<string | null>(null);
  if (filter.required.length === 0 && filter.hidden.length === 0) return null;
  const activePreset = matchingThreadTagPreset(presets, filter);

  const savePreset = () => {
    const name = presetName?.trim() ?? "";
    if (name === "") return setPresetName(null);
    const next = saveThreadTagPreset(presets, name.slice(0, 64), filter);
    if (next === null) {
      toastManager.add({
        type: "warning",
        title: "Preset not saved",
        description: "Delete a preset from the tag menu to save another.",
      });
      return;
    }
    onPresetsChange(next);
    setPresetName(null);
  };

  const chip = (tag: string, mode: ThreadTagMode) => (
    <Badge key={`${mode}:${tag}`} variant={mode === "required" ? "success" : "error"} size="sm">
      {mode === "required" ? "+" : "−"}
      {tag}
      <button
        type="button"
        aria-label={`Stop ${mode === "required" ? "requiring" : "hiding"} ${tag}`}
        className="-mr-0.5 grid place-items-center opacity-70 hover:opacity-100"
        onClick={() => onFilterChange(toggleThreadTagMode(filter, tag, mode))}
      >
        <XIcon className="size-2.5" />
      </button>
    </Badge>
  );

  return (
    <div className="flex flex-col gap-1 px-2 pt-1 pb-1.5 text-muted-foreground text-xs">
      <div className="flex min-w-0 items-center gap-2">
        {activePreset ? (
          <span className="flex min-w-0 items-center gap-1 font-medium text-foreground">
            <BookmarkIcon className="size-3 shrink-0" />
            <span className="truncate">{activePreset.name}</span>
          </span>
        ) : presetName !== null ? (
          <Input
            size="compact"
            autoFocus
            aria-label="Preset name"
            placeholder="Preset name"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            onBlur={savePreset}
            onKeyDown={(event) => {
              if (event.key === "Enter") savePreset();
              if (event.key === "Escape") setPresetName(null);
            }}
          />
        ) : (
          <Button size="xs" variant="ghost-muted" onClick={() => setPresetName("")}>
            Save as preset
          </Button>
        )}
        <span className="ml-auto shrink-0 tabular-nums">{hiddenCount} hidden</span>
        <Button
          size="xs"
          variant="ghost-muted"
          onClick={() => {
            setPresetName(null);
            onFilterChange(EMPTY_THREAD_TAG_FILTER);
          }}
        >
          Clear
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1">
        {filter.required.map((tag) => chip(tag, "required"))}
        {filter.hidden.map((tag) => chip(tag, "hidden"))}
      </div>
    </div>
  );
}
