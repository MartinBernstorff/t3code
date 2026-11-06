import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ThreadEngagement, ThreadId } from "@t3tools/contracts";
import { SquareArrowOutUpRightIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { editorLabelForPlatform } from "../../editorLabels";
import { useOpenInLastUsedEditor } from "../../openInLastUsedEditor";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { primaryServerAvailableEditorsAtom } from "../../state/server";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { shouldShowOpenInPicker } from "../chat/OpenInPicker.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { engagementAfterSidebarOpen } from "./sidebarOpenThread";

export function SidebarOpenThreadButton(props: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  engagement: ThreadEngagement;
  projectName: string;
  cwd: string;
}) {
  const availableEditors = useAtomValue(primaryServerAvailableEditorsAtom);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { remote, preferredEditor, open } = useOpenInLastUsedEditor(
    props.environmentId,
    availableEditors,
  );
  const setEngagement = useOrchestrationCommand(
    threadEnvironment.setEngagement,
    "set thread engagement",
  );
  const visible =
    preferredEditor !== null &&
    remote.mode !== "remote-unavailable" &&
    shouldShowOpenInPicker({
      activeProjectName: props.projectName,
      activeThreadEnvironmentId: props.environmentId,
      primaryEnvironmentId,
      remoteOpenMode: remote.mode,
    });
  if (!visible) return null;
  const label = `Open in ${editorLabelForPlatform(preferredEditor, navigator.platform)}`;

  const handleClick = async (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const opened = await open(props.cwd);
    const engagement = engagementAfterSidebarOpen({ opened, engagement: props.engagement });
    if (engagement === null) return;
    await setEngagement({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, engagement },
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={handleClick}
            onDoubleClick={(event) => event.stopPropagation()}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-transparent px-1.5 text-xs text-muted-foreground hover:text-foreground"
          />
        }
      >
        <SquareArrowOutUpRightIcon className="size-3" />
        Open
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}
