import type { ThreadEngagement } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { engagementAfterSidebarOpen } from "./sidebarOpenThread";

describe("engagementAfterSidebarOpen", () => {
  it.each<{ opened: boolean; engagement: ThreadEngagement; expected: ThreadEngagement | null }>([
    { opened: true, engagement: "inbox", expected: "engaged" },
    { opened: true, engagement: "queued", expected: "engaged" },
    { opened: true, engagement: "engaged", expected: null },
    { opened: false, engagement: "inbox", expected: null },
  ])("opened=$opened from $engagement → $expected", ({ opened, engagement, expected }) => {
    expect(engagementAfterSidebarOpen({ opened, engagement })).toBe(expected);
  });
});
