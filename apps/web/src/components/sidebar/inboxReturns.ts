import { createInboxReturnTracker } from "@t3tools/client-runtime/state/thread-inbox";

/** The sidebar observes it; the thread picker reads it so both place just-finished threads alike. */
export const sidebarInboxReturns = createInboxReturnTracker();
