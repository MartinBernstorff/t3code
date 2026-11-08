import type { ProviderDriverKind } from "@t3tools/contracts";
import { FolderGit2Icon, FolderIcon, GitBranchIcon } from "lucide-react";
import { ProjectFavicon, type ProjectFaviconProject } from "./ProjectFavicon";
import { ProviderInstanceIcon } from "./chat/ProviderInstanceIcon";
import { Fragment, type ReactNode } from "react";
import { cn } from "~/lib/utils";

import { MiddleTruncate } from "./ui/middle-truncate";

export type ThreadCommandSubtitleVariant =
  | "favicon-workspace-harness"
  | "favicon-workspace"
  | "favicon-branch-harness";

const THREAD_COMMAND_SUBTITLE_VARIANT: ThreadCommandSubtitleVariant = "favicon-workspace-harness";

export const COMMAND_PALETTE_META_ICON_CLASS = "size-3 shrink-0 text-muted-foreground/70";

export function CommandPaletteMetaDot() {
  return <span className="shrink-0 text-muted-foreground/50">·</span>;
}

function WorkspaceIcon(props: { variant: ThreadCommandSubtitleVariant; isWorktree: boolean }) {
  if (props.isWorktree) {
    return <FolderGit2Icon className={COMMAND_PALETTE_META_ICON_CLASS} aria-hidden />;
  }
  if (props.variant === "favicon-branch-harness") {
    return <GitBranchIcon className={COMMAND_PALETTE_META_ICON_CLASS} aria-hidden />;
  }
  return <FolderIcon className={COMMAND_PALETTE_META_ICON_CLASS} aria-hidden />;
}

export function ThreadCommandSubtitle(props: {
  project: ProjectFaviconProject | null;
  projectTitle: string | null;
  environmentLabel?: string | null;
  branch: string | null;
  worktreePath: string | null;
  isCurrent: boolean;
  driverKind?: ProviderDriverKind | null;
  providerDisplayName?: string | null;
  acpRegistryAgentId?: string | undefined;
  acpRegistryIconUrl?: string | undefined;
  variant?: ThreadCommandSubtitleVariant;
  className?: string;
}) {
  const variant = props.variant ?? THREAD_COMMAND_SUBTITLE_VARIANT;
  const isWorktree = props.worktreePath != null && props.worktreePath.trim().length > 0;
  const showHarness =
    variant !== "favicon-workspace" && props.driverKind != null && props.providerDisplayName;

  const projectLabel = props.projectTitle?.trim() || null;
  const branchLabel = props.branch?.trim() || null;
  const environmentLabel = props.environmentLabel?.trim() || null;
  const segments: Array<{ key: string; content: ReactNode }> = [];
  if (props.project || projectLabel) {
    segments.push({
      key: "project",
      content: (
        <span className="inline-flex min-w-0 items-center gap-1">
          {props.project ? (
            <ProjectFavicon project={props.project} className="size-3 shrink-0" />
          ) : null}
          {projectLabel ? <span className="min-w-0 truncate">{projectLabel}</span> : null}
        </span>
      ),
    });
  }
  if (environmentLabel) {
    segments.push({
      key: "environment",
      content: <span className="shrink-0">{environmentLabel}</span>,
    });
  }
  if (branchLabel) {
    segments.push({
      key: "branch",
      content: (
        <span className="inline-flex min-w-0 items-center gap-1">
          <WorkspaceIcon variant={variant} isWorktree={isWorktree} />
          <MiddleTruncate value={branchLabel} />
        </span>
      ),
    });
  }
  if (showHarness && props.driverKind) {
    segments.push({
      key: "harness",
      content: (
        <ProviderInstanceIcon
          driverKind={props.driverKind}
          displayName={props.providerDisplayName ?? props.driverKind}
          acpRegistryAgentId={props.acpRegistryAgentId}
          acpRegistryIconUrl={props.acpRegistryIconUrl}
          iconClassName="size-3 shrink-0 opacity-70"
        />
      ),
    });
  }
  if (props.isCurrent) {
    segments.push({ key: "current", content: <span className="shrink-0">Current thread</span> });
  }
  if (segments.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground/70",
        props.className,
      )}
    >
      {segments.map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 ? <CommandPaletteMetaDot /> : null}
          {segment.content}
        </Fragment>
      ))}
    </span>
  );
}
