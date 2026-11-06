import type { ThreadEngagement } from "@t3tools/contracts";

/** Opening a thread's workspace from the sidebar engages it; a failed open changes nothing. */
export function engagementAfterSidebarOpen(input: {
  readonly opened: boolean;
  readonly engagement: ThreadEngagement;
}): ThreadEngagement | null {
  return input.opened && input.engagement !== "engaged" ? "engaged" : null;
}
