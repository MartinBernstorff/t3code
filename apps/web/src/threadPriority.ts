import type { KeybindingCommand, ThreadPriority } from "@t3tools/contracts";

/** Menu order, most urgent first. */
export const THREAD_PRIORITY_OPTIONS: ReadonlyArray<{
  readonly value: ThreadPriority;
  readonly label: string;
  readonly shortcutCommand: KeybindingCommand;
}> = [
  { value: "urgent", label: "Urgent", shortcutCommand: "thread.priority.urgent" },
  { value: "high", label: "High", shortcutCommand: "thread.priority.high" },
  { value: "medium", label: "Medium", shortcutCommand: "thread.priority.medium" },
  { value: "low", label: "Low", shortcutCommand: "thread.priority.low" },
];

export const NO_PRIORITY_LABEL = "No priority";
export const NO_PRIORITY_SHORTCUT_COMMAND = "thread.priority.none" satisfies KeybindingCommand;
