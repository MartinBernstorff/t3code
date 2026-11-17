import {
  EMPTY_THREAD_TAG_FILTER,
  ThreadTag,
  type ThreadTagFilter,
  type ThreadTagFilterPreset,
} from "@t3tools/contracts";
import { CheckIcon, ChevronsUpDownIcon, MinusIcon, PlusIcon, TagIcon, XIcon } from "lucide-react";
import * as Schema from "effect/Schema";
import { createElement, type ReactNode, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
  ComboboxTrigger,
} from "../ui/combobox";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { toastManager } from "../ui/toast";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import {
  matchingThreadTagPreset,
  saveThreadTagPreset,
  threadTagMode,
  toggleThreadTagMode,
  type ThreadTagMode,
} from "./sidebarTagFilter.logic";
import { THREAD_TAG_PRESET_ICONS, threadTagPresetIcon } from "./threadTagPresetIcons";

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

// A type alias, not an interface, so it satisfies Base UI's index-signature `Group`.
type TagFilterGroup = {
  readonly value: "presets" | "tags";
  readonly items: ReadonlyArray<TagFilterItem>;
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

function PresetIcon(props: { name: string | undefined; className: string }) {
  return createElement(threadTagPresetIcon(props.name), {
    className: props.className,
    "aria-hidden": true,
  });
}

/** Required tags read as green `+tag`, hidden ones as grey `−tag`. */
function TagChip(props: { tag: string; mode: ThreadTagMode; onRemove?: () => void }) {
  const { tag, mode, onRemove } = props;
  return (
    <Badge variant={mode === "required" ? "success" : "secondary"} size="sm">
      {mode === "required" ? "+" : "−"}
      {tag}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Stop ${mode === "required" ? "requiring" : "hiding"} ${tag}`}
          className="-mr-0.5 grid place-items-center opacity-70 hover:opacity-100"
          onClick={onRemove}
        >
          <XIcon className="size-2.5" />
        </button>
      ) : null}
    </Badge>
  );
}

function PresetTags(props: { filter: ThreadTagFilter }) {
  return (
    <span className="flex min-w-0 shrink gap-1 overflow-hidden">
      {props.filter.required.map((tag) => (
        <TagChip key={`required:${tag}`} tag={tag} mode="required" />
      ))}
      {props.filter.hidden.map((tag) => (
        <TagChip key={`hidden:${tag}`} tag={tag} mode="hidden" />
      ))}
    </span>
  );
}

function PresetIconPicker(props: { icon: string | undefined; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button size="icon-xs" variant="default" />}
        aria-label="Change preset icon"
        title="Change preset icon"
      >
        <PresetIcon name={props.icon} className="size-3.5" />
      </PopoverTrigger>
      <PopoverPopup align="start" padding="compact">
        <div className="grid grid-cols-8 gap-1">
          {Object.entries(THREAD_TAG_PRESET_ICONS).map(([name, Icon]) => {
            const selected = threadTagPresetIcon(props.icon) === Icon;
            return (
              <Button
                key={name}
                size="icon-sm"
                variant={selected ? "default" : "ghost"}
                aria-label={name}
                aria-pressed={selected}
                onClick={() => {
                  props.onChange(name);
                  setOpen(false);
                }}
              >
                <Icon />
              </Button>
            );
          })}
        </div>
      </PopoverPopup>
    </Popover>
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { filter, presets, tagCounts, onFilterChange, onPresetsChange, open } = props;
  const [query, setQuery] = useState("");
  const activePreset = matchingThreadTagPreset(presets, filter);
  const activeCount = filter.required.length + filter.hidden.length;

  const knownTags = [
    ...new Set([...tagCounts.keys(), ...filter.required, ...filter.hidden]),
  ].toSorted((left, right) => left.localeCompare(right));
  const presetItems: TagFilterItem[] = presets.map((preset) => ({
    kind: "preset",
    value: `preset:${preset.name}`,
    label: preset.name,
    preset,
  }));
  const tagItems: TagFilterItem[] = knownTags.map((tag) => ({
    kind: "tag",
    value: `tag:${tag}`,
    label: tag,
    count: tagCounts.get(tag) ?? 0,
  }));
  const needle = query.trim();
  const matches = (item: TagFilterItem) => item.label.toLowerCase().includes(needle.toLowerCase());
  const filteredTagItems = tagItems.filter(matches);
  // A typed tag no thread has yet can still be required or hidden ahead of time.
  if (needle !== "" && isThreadTag(needle) && !knownTags.includes(needle)) {
    filteredTagItems.push({ kind: "tag", value: `tag:${needle}`, label: needle, count: null });
  }
  const groups = (presetRows: TagFilterItem[], tagRows: TagFilterItem[]): TagFilterGroup[] =>
    [
      { value: "presets" as const, items: presetRows },
      { value: "tags" as const, items: tagRows },
    ].filter((group) => group.items.length > 0);
  const items = groups(presetItems, tagItems);
  const filteredItems = groups(presetItems.filter(matches), filteredTagItems);

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
        props.onOpenChange(nextOpen);
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
          {(group: TagFilterGroup) => (
            <ComboboxGroup
              key={group.value}
              items={group.items}
              variant={group.value === "presets" ? "muted" : "default"}
            >
              <ComboboxGroupLabel>
                {group.value === "presets" ? "Presets" : "Tags"}
              </ComboboxGroupLabel>
              <ComboboxCollection>
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
                          <PresetIcon name={item.preset.icon} className="size-4" />
                        </BadgedIcon>
                        <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                        <PresetTags filter={item.preset} />
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
              </ComboboxCollection>
            </ComboboxGroup>
          )}
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
  onFilterChange: (filter: ThreadTagFilter) => void;
  onPresetsChange: (presets: ReadonlyArray<ThreadTagFilterPreset>) => void;
  onChoosePreset: () => void;
}) {
  const { filter, presets, onFilterChange, onPresetsChange } = props;
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
  const clear = () => {
    setPresetName(null);
    onFilterChange(EMPTY_THREAD_TAG_FILTER);
  };

  const chips = (
    <div className="flex min-w-0 flex-wrap gap-1">
      {filter.required.map((tag) => (
        <TagChip
          key={`required:${tag}`}
          tag={tag}
          mode="required"
          onRemove={() => onFilterChange(toggleThreadTagMode(filter, tag, "required"))}
        />
      ))}
      {filter.hidden.map((tag) => (
        <TagChip
          key={`hidden:${tag}`}
          tag={tag}
          mode="hidden"
          onRemove={() => onFilterChange(toggleThreadTagMode(filter, tag, "hidden"))}
        />
      ))}
    </div>
  );

  if (activePreset) {
    return (
      <div className="px-(--sidebar-content-inset) pt-1 pb-1.5 text-xs [--control-radius:var(--radius-md)]">
        <div className="flex min-w-0 items-center gap-2">
          <PresetIconPicker
            icon={activePreset.icon}
            onChange={(icon) =>
              onPresetsChange(
                presets.map((preset) => (preset === activePreset ? { ...preset, icon } : preset)),
              )
            }
          />
          <Button
            size="xs"
            variant="ghost"
            className="min-w-0"
            title="Choose a preset"
            onClick={props.onChoosePreset}
          >
            <span className="truncate font-medium text-sm">{activePreset.name}</span>
            <ChevronsUpDownIcon className="opacity-60" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2 pt-1 pb-1.5 text-muted-foreground text-xs">
      <div className="flex min-w-0 items-center gap-2">
        {presetName !== null ? (
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
        <Button size="xs" variant="ghost-muted" className="ml-auto" onClick={clear}>
          Clear
        </Button>
      </div>
      {chips}
    </div>
  );
}
