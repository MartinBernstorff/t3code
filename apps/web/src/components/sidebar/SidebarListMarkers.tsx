import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { cn } from "~/lib/utils";
import {
  animateSidebarLayoutChanges,
  sidebarMarkerId,
  type SidebarListMarker,
} from "../Sidebar.logic";
import { SIDEBAR_LANE_DEPTH_INSET, SIDEBAR_SORTABLE_DRAG_DISABLED } from "./SidebarThreadRow";

function SortableSidebarMarker(props: {
  marker: SidebarListMarker;
  className?: string;
  children?: ReactNode;
  revealOverflow?: boolean;
  "data-testid"?: string;
}) {
  const { node, setNodeRef, transform, transition } = useSortable({
    id: sidebarMarkerId(props.marker),
    disabled: SIDEBAR_SORTABLE_DRAG_DISABLED,
    animateLayoutChanges: animateSidebarLayoutChanges,
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the projected drop box inside the scroll viewport as drag transforms move it
  useLayoutEffect(() => {
    if (props.revealOverflow && transform?.y !== undefined) {
      node.current?.firstElementChild?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [node, props.revealOverflow, transform?.y]);
  return (
    <li
      ref={setNodeRef}
      data-thread-selection-safe
      data-testid={props["data-testid"]}
      className={cn("list-none", props.className)}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: props.marker.endsWith("-placeholder") ? "none" : transition,
        visibility: transform?.scaleY === 0 ? "hidden" : undefined,
      }}
    >
      {props.children}
    </li>
  );
}

export function SidebarSectionPlaceholder(props: {
  marker: "active-placeholder" | "settled-placeholder";
  label: string;
  showHint: boolean;
  isDropTarget: boolean;
}) {
  return (
    <SortableSidebarMarker
      marker={props.marker}
      data-testid={`sidebar-${props.marker}`}
      className="relative mx-0.5 -mb-px h-0"
      // Revealing on every drag scrolls the list out from under the pointer.
      revealOverflow={
        props.marker === "settled-placeholder" && props.showHint && props.isDropTarget
      }
    >
      {props.showHint ? (
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex h-9 items-center justify-center rounded-md border border-dashed border-sidebar-foreground/25 text-xs text-sidebar-foreground/80",
            props.isDropTarget && "border-primary/40 bg-primary/5 text-primary",
          )}
        >
          {props.label}
        </div>
      ) : null}
    </SortableSidebarMarker>
  );
}

export function SidebarDragBoundary(props: {
  marker: "pinned-header" | "pinned-divider";
  label: string;
  visible: boolean;
  isDropTarget: boolean;
}) {
  return (
    <SortableSidebarMarker
      marker={props.marker}
      data-testid={`sidebar-${props.marker}`}
      className="pointer-events-none relative mx-0.5 -mb-px h-0"
    >
      {props.visible ? (
        <div className="sidebar-drag-boundary-label absolute inset-x-2 top-1 flex h-4 items-center gap-2">
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              props.isDropTarget ? "text-primary" : "text-sidebar-foreground/80",
            )}
          >
            {props.label}
          </span>
          <span
            aria-hidden
            className={cn(
              "h-px flex-1",
              props.isDropTarget ? "bg-primary/50" : "bg-sidebar-foreground/25",
            )}
          />
        </div>
      ) : null}
    </SortableSidebarMarker>
  );
}

export function SidebarSectionHeader(props: {
  marker: "working-header" | "snoozed-header" | "settled-header";
  label: string;
  /** A muted trailing count; see `SidebarSectionCount`. */
  count: ReactNode;
  className?: string;
  dragging?: boolean;
  isDropTarget?: boolean;
  toggle: { expanded: boolean; onToggle: () => void };
}) {
  const shelf =
    props.marker === "working-header"
      ? "working"
      : props.marker === "snoozed-header"
        ? "snoozed"
        : "settled";
  return (
    <SortableSidebarMarker
      marker={props.marker}
      data-testid={`sidebar-${props.marker}`}
      className={cn("relative mx-0.5 h-8", props.className)}
    >
      <CollapsibleSectionHeader
        data-sidebar-row={`shelf:${shelf}`}
        onClick={props.toggle.onToggle}
        expanded={props.toggle.expanded}
        tone={props.isDropTarget ? "accent" : props.dragging ? "emphasized" : "muted"}
        data-testid={`sidebar-${shelf}-shelf-toggle`}
        accessory={props.count}
        chevron={false}
      >
        {props.label}
      </CollapsibleSectionHeader>
    </SortableSidebarMarker>
  );
}

/** The sidebar tree row of a Group by lane; its thread rows name it as their parent. */
export function sidebarLaneRowId(laneKey: string) {
  return `lane:${laneKey}`;
}

const LANE_DROP_ZONE_START = ["start-0", "start-3", "start-6"] as const;

/**
 * A lane's dashed drop zone, from its header to its last row. Lanes are flat sibling rows,
 * so the zone measures down to `lastRowId`; nested lanes' zones sit inside it.
 */
function SidebarLaneDropZone(props: {
  laneKey: string;
  lastRowId: string;
  depth: number;
  isDropTarget: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: sidebarLaneRowId(props.laneKey) });
  const zoneRef = useRef<HTMLDivElement | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- sizes the zone to its lane's sibling rows before paint; Group by rows hold still while dragging
  useLayoutEffect(() => {
    const zone = zoneRef.current;
    const header = zone?.parentElement;
    const last = header?.parentElement
      ?.querySelector(`[data-sidebar-row="${globalThis.CSS.escape(props.lastRowId)}"]`)
      ?.closest("li");
    if (zone && header && last instanceof HTMLElement) {
      zone.style.height = `${last.offsetTop + last.offsetHeight - header.offsetTop}px`;
    }
  }, [props.lastRowId]);
  return (
    <div
      ref={(element) => {
        zoneRef.current = element;
        setNodeRef(element);
      }}
      aria-hidden
      className={cn(
        "pointer-events-none absolute end-0 top-0 z-10 h-full rounded-md border border-dashed",
        LANE_DROP_ZONE_START[props.depth],
        props.isDropTarget ? "border-primary/40 bg-primary/5" : "border-sidebar-foreground/25",
      )}
    />
  );
}

/** A Group by lane header. Dropping a thread on its lane sets the lane's fields; lanes do not reorder. */
export function SidebarLaneHeader(props: {
  laneKey: string;
  /** The enclosing lane of a nested header, for keyboard tree navigation. */
  parentLaneKey: string | null;
  depth: number;
  label: string;
  count: ReactNode;
  expanded: boolean;
  /** Set while a thread drags and dropping it on this lane would change it. */
  dropZone: { lastRowId: string } | null;
  /** The dragged thread is over this lane and the drop would change it. */
  isDropTarget: boolean;
  onToggle: (laneKey: string) => void;
}) {
  return (
    <li
      data-thread-selection-safe
      className={cn("relative mx-0.5 h-8 list-none", SIDEBAR_LANE_DEPTH_INSET[props.depth])}
    >
      <CollapsibleSectionHeader
        data-sidebar-row={sidebarLaneRowId(props.laneKey)}
        data-sidebar-parent={
          props.parentLaneKey === null ? undefined : sidebarLaneRowId(props.parentLaneKey)
        }
        onClick={() => props.onToggle(props.laneKey)}
        expanded={props.expanded}
        tone={props.isDropTarget ? "accent" : props.dropZone ? "emphasized" : "muted"}
        accessory={props.count}
        chevron={false}
      >
        {props.label}
      </CollapsibleSectionHeader>
      {props.dropZone ? (
        <SidebarLaneDropZone
          laneKey={props.laneKey}
          lastRowId={props.dropZone.lastRowId}
          depth={props.depth}
          isDropTarget={props.isDropTarget}
        />
      ) : null}
    </li>
  );
}
