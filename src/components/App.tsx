import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useDrag, useWheel } from "@use-gesture/react";
import { Temporal } from "@js-temporal/polyfill";
import { Badge } from "@/components/ui/badge";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { EventMarker } from "./EventMarker";
import { EventTimelineBar } from "./EventTimelineBar";
import type {
  Event,
  EventWithTemporal,
  VisibleEventsConfig,
} from "@/types/event";
import { parseEventDates, isEventInViewport } from "@/types/event";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LAT_LONG_GOE = [51.541, 9.936];
const TIME_ZERO = {
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0,
};
const MINUTE_ZERO = {
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0,
};

interface AppProps {
  events: Event[];
}

abstract class TimeBadge {
  constructor(protected zdt: Temporal.ZonedDateTime) {}

  protected _start?: Temporal.ZonedDateTime;
  protected _end?: Temporal.ZonedDateTime;
  protected _duration?: Temporal.Duration;
  protected _days?: number;
  protected _startMilliseconds?: number;
  protected _endMilliseconds?: number;

  abstract get id(): string;
  abstract get start(): Temporal.ZonedDateTime;
  abstract get end(): Temporal.ZonedDateTime;
  abstract get next(): TimeBadge;
  abstract get labelTop(): string;
  abstract get labelBottom(): string;

  isPast(nowMilliseconds: number) {
    if (!this._endMilliseconds)
      this._endMilliseconds = this.end.epochMilliseconds;
    return this._endMilliseconds < nowMilliseconds;
  }

  isFuture(nowMilliseconds: number) {
    if (!this._startMilliseconds)
      this._startMilliseconds = this.start.epochMilliseconds;
    return this._startMilliseconds > nowMilliseconds;
  }

  get duration(): Temporal.Duration {
    if (!this._duration) this._duration = this.start.until(this.end);
    return this._duration;
  }

  x(startMilliseconds: number, ppd: number) {
    if (!this._startMilliseconds)
      this._startMilliseconds = this.start.epochMilliseconds;
    const ms = this._startMilliseconds - startMilliseconds;
    const pxPerMs = ppd / MS_PER_DAY;
    return pxPerMs * ms;
  }

  width(ppd: number): number {
    if (!this._startMilliseconds)
      this._startMilliseconds = this.start.epochMilliseconds;
    if (!this._endMilliseconds)
      this._endMilliseconds = this.end.epochMilliseconds;
    const pxPerMs = ppd / MS_PER_DAY;
    const ms = this._endMilliseconds - this._startMilliseconds;
    return pxPerMs * ms;
  }
}

class YearBadge extends TimeBadge {
  get id() {
    return `year-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start)
      this._start = this.zdt.with({
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ years: 1 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new YearBadge(this.zdt.add({ years: 1 }));
  }
  get labelTop() {
    return String(this.zdt.year);
  }
  get labelBottom() {
    return String(this.zdt.year);
  }
}

class MonthBadge extends TimeBadge {
  get id() {
    return `month-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start) this._start = this.zdt.with(TIME_ZERO).with({ day: 1 });
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ months: 1 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new MonthBadge(this.zdt.add({ months: 1 }));
  }
  get labelTop() {
    return this.zdt.toLocaleString("de-DE", { month: "long", year: "numeric" });
  }
  get labelBottom() {
    return this.zdt.toLocaleString("de-DE", { month: "short" });
  }
}

class WeekBadge extends TimeBadge {
  get id() {
    return `week-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start)
      this._start = this.zdt
        .subtract({ days: this.zdt.dayOfWeek - 1 })
        .with(TIME_ZERO);
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ days: 7 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new WeekBadge(this.zdt.add({ days: 7 }));
  }
  get labelTop() {
    return `KW${this.zdt.weekOfYear} ${this.zdt.year}`;
  }
  get labelBottom() {
    return `KW${this.zdt.weekOfYear}`;
  }
}

class DayBadge extends TimeBadge {
  get id() {
    return `day-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start) this._start = this.zdt.with(TIME_ZERO);
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ days: 1 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new DayBadge(this.zdt.add({ days: 1 }));
  }
  get labelTop() {
    return this.zdt.toLocaleString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  get labelBottom() {
    return this.zdt.toLocaleString("de-DE", {
      day: "numeric",
      month: "numeric",
    });
  }
}

class DaytimeBadge extends TimeBadge {
  get id() {
    return `daytime-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start)
      this._start = this.zdt
        .with({ hour: Math.floor(this.zdt.hour / 6) * 6 })
        .with(MINUTE_ZERO);
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ hours: 6 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new DaytimeBadge(this.zdt.add({ hours: 6 }));
  }
  get labelTop() {
    return `${this.zdt.toLocaleString("de-DE", { day: "numeric", month: "long" })}, ${this.start.hour}:00 - ${this.end.hour}:00 Uhr`;
  }
  get labelBottom() {
    return `${this.start.hour} - ${this.end.hour} Uhr`;
  }
}

class HourBadge extends TimeBadge {
  get id() {
    return `hour-${this.start.epochMilliseconds}`;
  }
  get start() {
    if (!this._start) this._start = this.zdt.with(MINUTE_ZERO);
    return this._start;
  }
  get end() {
    if (!this._end)
      this._end = this.start.add({ hours: 1 }).subtract({ nanoseconds: 1 });
    return this._end;
  }
  get next() {
    return new HourBadge(this.zdt.add({ hours: 1 }));
  }
  get labelTop() {
    return `${this.start.hour}:00`;
  }
  get labelBottom() {
    return `${this.start.hour}:00`;
  }
}

type BadgeConstructor = new (datetime: Temporal.ZonedDateTime) => TimeBadge;

interface ZoomLevel {
  top: BadgeConstructor;
  bottom: BadgeConstructor;
  ppd: number;
}

const ZOOM_LEVELS: ZoomLevel[] = [
  { top: YearBadge, bottom: MonthBadge, ppd: 1.5 },
  { top: MonthBadge, bottom: WeekBadge, ppd: 8 },
  { top: WeekBadge, bottom: DayBadge, ppd: 48 },
  { top: DayBadge, bottom: DaytimeBadge, ppd: 350 },
  { top: DaytimeBadge, bottom: HourBadge, ppd: 1200 },
];

interface Layout {
  top: TimeBadge[];
  bottom: TimeBadge[];
  startMilliseconds: number;
  ppd: number;
  nowMilliseconds: number;
}

function generateBadges(
  badgeConstrutor: BadgeConstructor,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): TimeBadge[] {
  const badges: TimeBadge[] = [];
  let badge = new badgeConstrutor(start);
  badges.push(badge);
  while (badge.start.epochMilliseconds < end.epochMilliseconds) {
    badge = badge.next;
    badges.push(badge);
  }
  return badges;
}

function getVisibleRange(
  center: Temporal.ZonedDateTime,
  zoom: number,
  width: number,
): {
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  duration: Temporal.Duration;
} {
  const msPerPx = MS_PER_DAY / ZOOM_LEVELS[zoom].ppd;
  const start = center.add({
    milliseconds: Math.floor(-width * 0.25 * msPerPx),
  });
  const end = center.add({ milliseconds: Math.floor(width * 0.75 * msPerPx) });
  return { start, end, duration: start.until(end) };
}

export default function App({ events }: AppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const timeline = useRef({
    center: Temporal.Now.zonedDateTimeISO(),
    zoom: 0,
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [mapVersion, setMapVersion] = useState(0);

  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  // Parse events with Temporal dates
  const eventsWithTemporal: EventWithTemporal[] = useMemo(() => {
    return events.map((event) => parseEventDates(event, Temporal));
  }, [events]);

  // Get visible events based on map bounds and timeline viewport
  const visibleEvents = useMemo(() => {
    if (!mapInstance.current || !mapReady) {
      return [];
    }

    const bounds = mapInstance.current.getBounds();
    const width = containerRef.current?.clientWidth || 0;
    const { start, end } = getVisibleRange(
      timeline.current.center,
      timeline.current.zoom,
      width,
    );

    const config: VisibleEventsConfig = {
      mapBounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      timelineStart: start,
      timelineEnd: end,
    };

    return eventsWithTemporal.filter((event) =>
      isEventInViewport(event, config),
    );
  }, [eventsWithTemporal, mapReady, timelineVersion, mapVersion]);

  useEffect(() => {
    const handleResize = () => rerender();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [rerender]);

  useEffect(() => {
    requestAnimationFrame(() => rerender());
  }, [rerender]);

  const getVisibleWidth = useCallback(() => {
    if (!containerRef.current) return 0;
    return containerRef.current.clientWidth;
  }, []);

  const computeLayout = useCallback((): Layout => {
    const width = getVisibleWidth();
    const { center, zoom } = timeline.current;
    const z = ZOOM_LEVELS[zoom];
    const { start, end } = getVisibleRange(center, zoom, width);
    const top: TimeBadge[] = generateBadges(z.top, start, end);
    const bottom: TimeBadge[] = generateBadges(z.bottom, start, end);
    const now = Temporal.Now.zonedDateTimeISO();
    return {
      top,
      bottom,
      startMilliseconds: start.epochMilliseconds,
      nowMilliseconds: now.epochMilliseconds,
      ppd: z.ppd,
    };
  }, [getVisibleWidth]);

  const initialCenterTime = useRef(Temporal.Now.zonedDateTimeISO());
  useDrag(
    ({ down, movement: [mx] }) => {
      if (!down) {
        initialCenterTime.current = timeline.current.center;
        return;
      }
      const ppd = ZOOM_LEVELS[timeline.current.zoom].ppd;
      const msPerPx = MS_PER_DAY / ppd;
      const timeDelta = -mx * msPerPx;
      timeline.current.center = initialCenterTime.current.add({
        milliseconds: Math.round(timeDelta),
      });
      setTimelineVersion((v) => v + 1);
      rerender();
    },
    {
      threshold: 10,
      target: containerRef,
    },
  );

  const lastZoomTime = useRef(0);
  useWheel(
    ({ delta: [, dy] }) => {
      if (dy === 0) return;
      const now = Date.now();
      if (now - lastZoomTime.current < 150) return;
      lastZoomTime.current = now;
      const direction = dy > 0 ? -1 : 1;
      const newZoom = Math.max(
        0,
        Math.min(ZOOM_LEVELS.length - 1, timeline.current.zoom + direction),
      );
      timeline.current.zoom = newZoom;
      setTimelineVersion((v) => v + 1);
      rerender();
    },
    {
      target: containerRef,
    },
  );

  const lastClickTime = useRef(0);
  const DOUBLE_CLICK_DELAY = 300;
  const handleTimelineClick = () => {
    const now = Date.now();

    if (now - lastClickTime.current < DOUBLE_CLICK_DELAY) {
      timeline.current.center = Temporal.Now.zonedDateTimeISO();
      initialCenterTime.current = timeline.current.center;
      setTimelineVersion((v) => v + 1);
      rerender();
    }

    lastClickTime.current = now;
  };

  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const isTouchDragging = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      isTouchDragging.current = false;

      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isTouchDragging.current = true;
        lastTouchX.current = touchStartX;
        lastTouchY.current = touchStartY;
      } else if (e.touches.length === 2) {
        isTouchDragging.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchDragging.current && e.touches.length === 1) {
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const xDiff = Math.abs(touchX - touchStartX);
        const yDiff = Math.abs(touchY - touchStartY);

        if (xDiff < 10 && yDiff < 10) return;

        if (xDiff > yDiff) {
          if (e.cancelable) e.preventDefault();
          const ppd = ZOOM_LEVELS[timeline.current.zoom].ppd;
          const msPerPx = MS_PER_DAY / ppd;
          const mx = touchX - touchStartX;
          const timeDelta = -mx * msPerPx;
          timeline.current.center = initialCenterTime.current.add({
            milliseconds: Math.round(timeDelta),
          });
          setTimelineVersion((v) => v + 1);
          rerender();
          return;
        }

        isTouchDragging.current = false;
        const direction = touchStartY - touchY;
        const newZoom = Math.max(
          0,
          Math.min(
            ZOOM_LEVELS.length - 1,
            timeline.current.zoom - direction / Math.abs(direction),
          ),
        );
        timeline.current.zoom = newZoom;
        setTimelineVersion((v) => v + 1);
        rerender();
      }
    };

    const handleTouchEnd = () => {
      isTouchDragging.current = false;
      initialCenterTime.current = timeline.current.center;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [getVisibleWidth, rerender]);

  const layout = computeLayout();

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current, {
      center: LAT_LONG_GOE as L.LatLngTuple,
      zoom: 10,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapInstance.current);

    // Listen for map move/zoom to trigger event filtering
    const handleMapChange = () => {
      setMapVersion((v) => v + 1);
      rerender();
    };
    mapInstance.current.on("moveend", handleMapChange);
    mapInstance.current.on("zoomend", handleMapChange);

    // Mark map as ready to trigger event filtering
    setMapReady(true);

    return () => {
      mapInstance.current?.off("moveend", handleMapChange);
      mapInstance.current?.off("zoomend", handleMapChange);
      mapInstance.current?.remove();
      mapInstance.current = null;
      setMapReady(false);
    };
  }, [rerender]);

  const p = 4;
  const h = 22;
  const eventBarHeight = 28;
  const eventBarPadding = 4;

  const handleEventClick = useCallback(
    (event: Event) => {
      setSelectedEventId(event.id);
      // Center timeline on event
      const eventStart = Temporal.Instant.from(
        event.startTime,
      ).toZonedDateTimeISO(Temporal.Now.timeZoneId());
      timeline.current.center = eventStart;
      initialCenterTime.current = eventStart;
      setTimelineVersion((v) => v + 1);
      rerender();
    },
    [rerender],
  );

  return (
    <main className="h-[calc(100dvh-40px-4px-22px-4px-22px-4px)]">
      <div ref={mapRef} className="w-full h-full select-none relative">
        {/* Event markers on map */}
        {mapReady &&
          visibleEvents.map((event) => (
            <EventMarker
              key={`${event.id}-${timelineVersion}-${mapVersion}`}
              event={event}
              map={mapInstance.current!}
              isSelected={selectedEventId === event.id}
              onClick={handleEventClick}
            />
          ))}
      </div>
      <div
        ref={containerRef}
        className="w-full overflow-hidden select-none cursor-grab border-solid border-gray-300 dark:border-gray-700"
        style={{
          touchAction: "none",
          willChange: "transform",
          height: `${p + h + p + h + p + eventBarHeight + eventBarPadding}px`,
        }}
        onClick={handleTimelineClick}
      >
        <svg
          width={getVisibleWidth()}
          height={p + h + p + h + p + eventBarHeight + eventBarPadding}
          className="block"
          style={{ backgroundColor: "transparent" }}
        >
          {/* Event layer - third layer above time badges */}
          {visibleEvents.map((event) => (
            <EventTimelineBar
              key={`${event.id}-${timelineVersion}-${mapVersion}`}
              event={event}
              timelineStartMs={layout.startMilliseconds}
              pixelsPerDay={layout.ppd}
              isSelected={selectedEventId === event.id}
              onClick={() => handleEventClick(event)}
            />
          ))}

          {layout.bottom.map((badge) => (
            <foreignObject
              key={badge.id}
              x={badge.x(layout.startMilliseconds, layout.ppd)}
              y={p + eventBarHeight + eventBarPadding}
              width={badge.width(layout.ppd)}
              height={h}
            >
              <div className="w-full h-full flex items-center justify-center">
                <Badge
                  variant={
                    badge.isPast(layout.nowMilliseconds)
                      ? "past"
                      : badge.isFuture(layout.nowMilliseconds)
                        ? "future"
                        : "present"
                  }
                  className="flex w-full"
                >
                  {badge.labelBottom}
                </Badge>
              </div>
            </foreignObject>
          ))}

          {layout.top.map((badge) => (
            <foreignObject
              key={badge.id}
              x={badge.x(layout.startMilliseconds, layout.ppd)}
              y={p + eventBarHeight + eventBarPadding + h + p}
              width={badge.width(layout.ppd)}
              height={h}
            >
              <div className="w-full h-full flex items-center justify-center">
                <Badge
                  variant={
                    badge.isPast(layout.nowMilliseconds)
                      ? "past"
                      : badge.isFuture(layout.nowMilliseconds)
                        ? "future"
                        : "present"
                  }
                  className="flex w-full"
                >
                  {badge.labelTop}
                </Badge>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
    </main>
  );
}
