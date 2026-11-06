import type { ThreadEngagement } from "@t3tools/contracts";

/** Menu order. */
export const THREAD_ENGAGEMENT_OPTIONS: ReadonlyArray<{
  readonly value: ThreadEngagement;
  readonly label: string;
}> = [
  { value: "engaged", label: "Engaged" },
  { value: "inbox", label: "Inbox" },
  { value: "queued", label: "Queued" },
];
