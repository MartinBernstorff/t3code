import type { ThreadPriority } from "@t3tools/contracts";

/** Menu order, most urgent first. */
export const THREAD_PRIORITY_OPTIONS: ReadonlyArray<{
  readonly value: ThreadPriority;
  readonly label: string;
}> = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
