import * as React from "react";
import L from "leaflet";
import type { Event } from "@/types/event";

interface EventMarkerProps {
  event: Event;
  map: L.Map;
  isSelected: boolean;
  onClick: (event: Event) => void;
}

export function EventMarker({
  event,
  map,
  isSelected,
  onClick,
}: EventMarkerProps) {
  const markerRef = React.useRef<L.Marker | null>(null);

  React.useEffect(() => {
    if (!map) return;

    const icon = L.divIcon({
      className: "custom-event-marker",
      html: `<div style="
        width: 24px;
        height: 24px;
        background-color: ${isSelected ? "#dc2626" : "#16a34a"};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([event.location.lat, event.location.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>${event.title}</b><br/>${event.location.name}`);

    marker.on("click", () => onClick(event));
    markerRef.current = marker;

    return () => {
      marker.remove();
    };
  }, [map, event, isSelected, onClick]);

  React.useEffect(() => {
    if (markerRef.current && isSelected) {
      markerRef.current.openPopup();
    }
  }, [isSelected]);

  return null;
}
