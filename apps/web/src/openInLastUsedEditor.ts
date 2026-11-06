import {
  AuthOrchestrationOperateScope,
  buildRemoteOpenUrl,
  type EditorId,
  type EnvironmentId,
} from "@t3tools/contracts";

import { usePreferredEditor } from "./editorPreferences";
import {
  openRemoteEditorUrl,
  useRemoteCapableEditors,
  useRemoteOpenHint,
  useRemoteOpenState,
} from "./remoteOpen";
import { readEnvironmentScope } from "./state/session";
import { shellEnvironment } from "./state/shell";
import { useAtomCommand } from "./state/use-atom-command";

/**
 * Opens a path in the last-used editor, or in `options.editor`, which then becomes the last used.
 * Covers both host-side launches and remote editor links.
 */
export function useOpenInLastUsedEditor(
  environmentId: EnvironmentId,
  availableEditors: ReadonlyArray<EditorId>,
) {
  const openInEditorMutation = useAtomCommand(shellEnvironment.openInEditor, "open in editor");
  const remote = useRemoteOpenState(environmentId);
  const remoteCapableEditors = useRemoteCapableEditors();
  const [, markRemoteHintSeen] = useRemoteOpenHint();
  // Remote editors run on the viewing machine; only desktop can probe that PATH.
  const editors = remote.mode === "local-exec" ? availableEditors : remoteCapableEditors;
  const [preferredEditor, setPreferredEditor] = usePreferredEditor(editors);

  const open = async (
    path: string,
    options: { editor?: EditorId; isFile?: boolean; revealFileManager?: boolean } = {},
  ): Promise<boolean> => {
    const editor = options.editor ?? preferredEditor;
    if (!editor || remote.mode === "remote-unavailable") return false;
    if (remote.mode === "remote-links") {
      const url = buildRemoteOpenUrl({
        editor,
        ...remote.host,
        absolutePath: path,
        isFile: options.isFile ?? false,
      });
      if (url === undefined) return false;
      // Only record hint-seen/preferred when the shell actually accepted
      // the URL (an older desktop build can refuse the editor scheme).
      if (!(await openRemoteEditorUrl(url))) return false;
      markRemoteHintSeen();
      setPreferredEditor(editor);
      return true;
    }
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) return false;
    const result = openInEditorMutation({
      environmentId,
      input: {
        cwd: path,
        editor,
        ...(options.revealFileManager && editor === "file-manager" ? { reveal: true } : {}),
      },
    });
    setPreferredEditor(editor);
    return (await result)._tag === "Success";
  };

  return { remote, editors, preferredEditor, open };
}
