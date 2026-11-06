import type { ThreadPriority } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

const FILLED_BARS: Record<Exclude<ThreadPriority, "urgent">, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function ThreadPriorityGlyph(props: {
  readonly priority: ThreadPriority;
  readonly className?: string;
}) {
  if (props.priority === "urgent") {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={cn("size-3.5 shrink-0 text-warning", props.className)}
      >
        <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />
        <path d="M8 4v5" className="stroke-background" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="8" cy="11.75" r="1" className="fill-background" />
      </svg>
    );
  }
  const filled = FILLED_BARS[props.priority];
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("size-3.5 shrink-0 text-muted-foreground", props.className)}
    >
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={1.5 + index * 5}
          y={9 - index * 3.5}
          width="3"
          height={5 + index * 3.5}
          rx="1"
          fill="currentColor"
          opacity={index < filled ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}
