import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { SidebarStackPlacement, SidebarStackStep } from "./sidebarStacks";

const STEP_CLASS_NAME: Record<SidebarStackStep, string> = {
  merged: "bg-muted-foreground/45",
  closed: "bg-muted-foreground/15",
  finished: "bg-success",
  next: "bg-primary",
  open: "border border-border",
};

/** Draws rows of one GitHub stack as a ladder: a header on the first row, then a numbered spine. */
export function SidebarStackFrame(props: {
  placement: SidebarStackPlacement;
  children: ReactNode;
}) {
  const { placement } = props;
  const merged = placement.header?.steps.filter((step) => step === "merged").length ?? 0;
  return (
    <>
      {placement.header === null ? null : (
        <div className="flex h-5 items-center gap-1.5 ps-1 pe-2.5 text-2xs text-muted-foreground">
          <span className="truncate">
            <span className="font-medium text-secondary-label">
              Stack → {placement.header.base}
            </span>
            {merged > 0 ? ` · ${merged} merged` : null}
          </span>
          <span
            role="img"
            aria-label={`Stack of ${placement.size}, layers bottom to top: ${placement.header.steps.join(", ")}`}
            className="ml-auto flex shrink-0 gap-0.5"
          >
            {placement.header.steps.map((step, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- layers have no identity beyond their position
              <span key={index} className={cn("size-1.5 rounded-xs", STEP_CLASS_NAME[step])} />
            ))}
          </span>
        </div>
      )}
      <div className="relative ps-5">
        <span
          aria-hidden
          className={cn(
            "absolute left-2 w-px bg-border",
            placement.runStart ? "top-4 -bottom-1" : placement.runEnd ? "-top-1 h-5" : "-inset-y-1",
          )}
        />
        <span
          className={cn(
            "absolute top-2 left-0.5 z-20 grid size-4 place-items-center rounded-full border font-mono text-3xs leading-none",
            placement.isNext
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-sidebar text-muted-foreground",
          )}
        >
          {placement.layer}
          {placement.isNext ? <span className="sr-only">, next layer in this stack</span> : null}
        </span>
        {props.children}
      </div>
    </>
  );
}
