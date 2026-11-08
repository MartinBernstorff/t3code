import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";
import { TooltipProvider } from "../ui/tooltip";
import { SidebarSectionCount } from "./SidebarCountTokens";
import { SIDEBAR_LANE_DEPTH_INSET } from "./SidebarThreadRow";

export interface SidebarMinimalSection {
  readonly key: string;
  readonly label: string;
  readonly threads: ComponentProps<typeof SidebarSectionCount>["threads"];
  readonly depth: number;
}

/** The minimal sidebar: one header and count per section or lane, without thread rows. */
export function SidebarMinimalSections(props: { sections: readonly SidebarMinimalSection[] }) {
  return (
    <TooltipProvider delay={150} closeDelay={0} timeout={400}>
      <ul aria-label="Thread sections" className="flex flex-col gap-px">
        {props.sections.map((section) => (
          <li
            key={section.key}
            className={cn(
              "mx-0.5 flex h-8 items-center gap-2 px-2 text-xs font-medium text-sidebar-muted-foreground",
              SIDEBAR_LANE_DEPTH_INSET[section.depth],
            )}
          >
            <span className="min-w-0 flex-1 truncate">{section.label}</span>
            <SidebarSectionCount threads={section.threads} />
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
}
