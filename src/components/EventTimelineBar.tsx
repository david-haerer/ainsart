import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { EventWithTemporal } from "@/types/event";
import { getEventXPosition, getEventWidth } from "@/types/event";

interface EventTimelineBarProps {
  event: EventWithTemporal;
  timelineStartMs: number;
  pixelsPerDay: number;
  isSelected: boolean;
  onClick: () => void;
}

export function EventTimelineBar({
  event,
  timelineStartMs,
  pixelsPerDay,
  isSelected,
  onClick,
}: EventTimelineBarProps) {
  const x = getEventXPosition(event, timelineStartMs, pixelsPerDay);
  const width = getEventWidth(event, pixelsPerDay);

  return (
    <foreignObject
      x={x}
      y={4}
      width={width}
      height={28}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <div className="w-full h-full flex items-center justify-center px-1">
        <Badge
          variant={isSelected ? "destructive" : "default"}
          className="w-full h-full flex items-center justify-center text-xs truncate"
          style={{
            backgroundColor: isSelected ? "#dc2626" : "#16a34a",
            border: "2px solid white",
          }}
        >
          <span className="truncate">{event.title}</span>
        </Badge>
      </div>
    </foreignObject>
  );
}
