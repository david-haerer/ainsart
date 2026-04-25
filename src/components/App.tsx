import { useEffect, useRef, useState, useCallback } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { Badge } from "@/components/ui/badge";
import L, { type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

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

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

abstract class TimeBadge {
  constructor(protected zdt: Temporal.ZonedDateTime) { }

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
  abstract label(ppd: number): string;

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
  label(ppd: number) {
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
  label(ppd: number) {
    if (ppd <= 2.8) return this.zdt.toLocaleString("de-DE", { month: "short" });
    if (ppd <= 4.1) return this.zdt.toLocaleString("de-DE", { month: "long" });
    return this.zdt.toLocaleString("de-DE", { month: "long", year: "numeric" });
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
  label(ppd: number) {
    if (ppd < 8) return `W${this.zdt.weekOfYear}`;
    if (ppd < 13) return `KW${this.zdt.weekOfYear}`;
    return `KW${this.zdt.weekOfYear} ${this.zdt.year}`;
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
  label(ppd: number) {
    if (ppd < 64) return this.zdt.toLocaleString("de-DE", { day: "numeric", month: "numeric" });
    if (ppd < 100) return this.zdt.toLocaleString("de-DE", { day: "numeric", month: "short" });
    if (ppd < 120) return this.zdt.toLocaleString("de-DE", { day: "numeric", month: "short", year: "numeric" });
    return this.zdt.toLocaleString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  }
}

class DaytimeBadge extends TimeBadge {
  get id() { return `daytime-${this.start.epochMilliseconds}` }
  get start() {
    if (!this._start) this._start = this.zdt.with({ hour: Math.floor(this.zdt.hour / 6) * 6 }).with(MINUTE_ZERO)
    return this._start
  }
  get end() {
    if (!this._end) this._end = this.start.add({ hours: 6 }).subtract({ nanoseconds: 1 })
    return this._end
  }
  get next() { return new DaytimeBadge(this.zdt.add({ hours: 6 })) }
  label(ppd: number) {
    if (ppd < 500) return `${this.start.hour} - ${this.end.hour} Uhr`;
    if (ppd < 800) return `${this.start.hour}:00 - ${this.end.hour}:00 Uhr`;
    return `${this.zdt.toLocaleString('de-DE', { day: 'numeric', month: "short" })}, ${this.start.hour}:00 - ${this.end.hour}:00 Uhr`;
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
  label(ppd: number) {
    if (ppd < 1200) return `${this.start.hour}`;
    if (ppd < 1900) return `${this.start.hour}:00`;
    return `${this.start.hour}:00 Uhr`;
  }
}

type BadgeConstructor = new (datetime: Temporal.ZonedDateTime) => TimeBadge;

interface ZoomLevel {
  top: BadgeConstructor;
  bottom: BadgeConstructor;
}

function getTopBottom(ppd: number): ZoomLevel {
  if (ppd < 6) return { top: YearBadge, bottom: MonthBadge }
  if (ppd < 48) return { top: MonthBadge, bottom: WeekBadge }
  if (ppd < 350) return { top: WeekBadge, bottom: DayBadge }
  if (ppd < 800) return { top: DayBadge, bottom: DaytimeBadge }
  return { top: DaytimeBadge, bottom: HourBadge }
}

class EventBadge extends TimeBadge {
  constructor(
    readonly start: Temporal.ZonedDateTime,
    readonly end: Temporal.ZonedDateTime,
    readonly title: string,
  ) {
    super(start);
  }
  get id() {
    return `event-${this.title}-${this.start.epochMilliseconds}`;
  }
  get next() {
    return this;
  }
  label(ppd: number) {
    const estimatedChars = Math.floor(this.width(ppd) / 8);
    return this.title.length <= estimatedChars
      ? this.title
      : this.title.slice(0, estimatedChars - 2) + "…";
  }
  width(ppd: number): number {
    const actualWidth = super.width(ppd);
    return Math.max(actualWidth, 22);
  }
}

class Event {
  constructor(
    readonly title: string,
    readonly place: string,
    readonly url: string,
    readonly badges: EventBadge[],
    readonly latlng: LatLngExpression,
    readonly organizer: string,
  ) { }
  get id(): string {
    return slug(this.title);
  }
  isVisible(
    mapBounds: L.LatLngBounds | null,
    startMilliseconds: number,
    endMilliseconds: number,

  ): boolean {
    const hasTimeOverlap = this.badges.some(
      (badge) =>
        badge.start.epochMilliseconds > startMilliseconds &&
        badge.end.epochMilliseconds < endMilliseconds
    );
    if (hasTimeOverlap) return false;
    if (mapBounds) {
      return mapBounds.contains(this.latlng);
    }
    return true;
  }
  getMarkerPopupHTML(): string {
    return `
      <div style="min-width: 200px;">
        <strong>${this.title}</strong><br/>
        <small>${this.place}</small><br/>
        <small>Organizer: ${this.organizer}</small>
      </div>
    `;
  }
}

const EVENTS: Event[] = [
  new Event(
    "Keramikmarkt Paderborn",
    "Neuhäuser Schlosspark",
    "https://www.paderborn.de/tourismus-kultur/veranstaltungen/Keramikmarkt.php",
    [
      new EventBadge(
        Temporal.ZonedDateTime.from("2026-04-25T11:00+02:00[Europe/Berlin]"),
        Temporal.ZonedDateTime.from("2026-04-25T18:00+02:00[Europe/Berlin]"),
        "Keramikmarkt Paderborn",
      ),
      new EventBadge(
        Temporal.ZonedDateTime.from("2026-04-26T11:00+02:00[Europe/Berlin]"),
        Temporal.ZonedDateTime.from("2026-04-26T18:00+02:00[Europe/Berlin]"),
        "Keramikmarkt Paderborn",
      ),
    ],
    [51.7459595, 8.7104291],
    "Schlosspark und Lippesee Gesellschaft",
  ),
];



interface Layout {
  top: TimeBadge[];
  bottom: TimeBadge[];
  startMilliseconds: number;
  endMilliseconds: number;
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


export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  window.debugLog = (msg: string) => {
    const el = document.getElementById('debug') || document.createElement('div')
    el.id = 'debug'
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#000;color:#0f0;font:12px monospace;z-index:9999;max-height:200px;overflow:auto;'
    if (!el.parentNode) document.body.appendChild(el)
    el.innerHTML = `<div>${msg}</div>`
  }

  const timeline = useRef({
    x: typeof window !== "undefined" ? window.innerWidth * 0.25 : 300,
    zdt: Temporal.Now.zonedDateTimeISO(),
    ppd: 12,
  });

  const map = useRef({
    center: LAT_LONG_GOE,
    zoom: 10,
  });

  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

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
    const { zdt, ppd } = timeline.current;
    const msPerPx = MS_PER_DAY / ppd;
    const start = zdt.subtract({ milliseconds: Math.floor(timeline.current.x * msPerPx) });
    const end = zdt.add({ milliseconds: Math.floor((width - timeline.current.x) * msPerPx) });
    const { top: TopBadge, bottom: BottomBadge } = getTopBottom(ppd)
    const top: TimeBadge[] = generateBadges(TopBadge, start, end);
    const bottom: TimeBadge[] = generateBadges(BottomBadge, start, end);
    const now = Temporal.Now.zonedDateTimeISO();
    return {
      top,
      bottom,
      startMilliseconds: start.epochMilliseconds,
      endMilliseconds: end.epochMilliseconds,
      nowMilliseconds: now.epochMilliseconds,
      ppd,
    };
  }, [getVisibleWidth]);

  const WHEEL_SENSITIVITY = 0.002;
  const MIN_PPD = 1.2;
  const MAX_PPD = 2400;

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let isPinching = false
    let initialPinchDistance = 0
    let initialPpd = 0
    let lastDragX = 0
    const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      return Math.sqrt(dx * dx + dy * dy)
    }
    const getMidpointX = (p1: { x: number }, p2: { x: number }) => {
      return (p1.x + p2.x) / 2
    }
    const setOrigin = (x: number) => {
      const msPerPx = MS_PER_DAY / timeline.current.ppd
      timeline.current.zdt = timeline.current.zdt.add({
        milliseconds: Math.round((x - timeline.current.x) * msPerPx),
      })
      timeline.current.x = x
    }
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      if (pointers.size === 1) {
        lastDragX = e.clientX
        setOrigin(e.clientX)
      } else if (pointers.size === 2) {
        isPinching = true
        const pts = Array.from(pointers.values())
        initialPinchDistance = getDistance(pts[0], pts[1])
        initialPpd = timeline.current.ppd
        setOrigin(getMidpointX(pts[0], pts[1]))
      }
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (isPinching && pointers.size >= 2) {
        e.preventDefault()
        const pts = Array.from(pointers.values())
        const newDistance = getDistance(pts[0], pts[1])
        const ratio = newDistance / initialPinchDistance
        timeline.current.ppd = Math.max(MIN_PPD, Math.min(MAX_PPD, initialPpd * ratio))
        rerender()
      } else if (!isPinching && pointers.size === 1) {
        e.preventDefault()
        const dx = e.clientX - lastDragX
        lastDragX = e.clientX
        timeline.current.x = timeline.current.x + dx
        rerender()
      }
    }
    const handlePointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (isPinching && pointers.size < 2) {
        isPinching = false
        if (pointers.size === 1) {
          const remaining = Array.from(pointers.values())[0]
          lastDragX = remaining.x
          setOrigin(remaining.x)
        }
      }
    }
    el.addEventListener("pointerdown", handlePointerDown, { passive: false })
    el.addEventListener("pointermove", handlePointerMove, { passive: false })
    el.addEventListener("pointerup", handlePointerUp)
    el.addEventListener("pointercancel", handlePointerUp)
    return () => {
      el.removeEventListener("pointerdown", handlePointerDown)
      el.removeEventListener("pointermove", handlePointerMove)
      el.removeEventListener("pointerup", handlePointerUp)
      el.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [rerender])

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const msPerPx = MS_PER_DAY / timeline.current.ppd;
      timeline.current.zdt = timeline.current.zdt.add({ milliseconds: Math.round((e.clientX - timeline.current.x) * msPerPx) });
      timeline.current.x = e.clientX;
      timeline.current.ppd = Math.max(MIN_PPD, Math.min(MAX_PPD, timeline.current.ppd * Math.exp(-e.deltaY * WHEEL_SENSITIVITY)));
      rerender();
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => { el.removeEventListener("wheel", handleWheel); };
  }, [rerender]);

  const lastClickTime = useRef(0);
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      const msPerPx = MS_PER_DAY / timeline.current.ppd;
      timeline.current.zdt = timeline.current.zdt.add({ milliseconds: Math.round((event.clientX - timeline.current.x) * msPerPx) });
      timeline.current.x = event.clientX;
      timeline.current.ppd = Math.max(MIN_PPD, Math.min(MAX_PPD, timeline.current.ppd * Math.exp(500 * WHEEL_SENSITIVITY)));
      rerender();
    }
    lastClickTime.current = now;
  };

  const layout = computeLayout();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current, {
      center: map.current.center as L.LatLngTuple,
      zoom: map.current.zoom,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapInstance.current);
    const latLngs = EVENTS.map((e) => e.latlng);
    const bounds = L.latLngBounds(latLngs);

    mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [map.current.center, map.current.zoom]);

  const eventMarkersRef = useRef<L.Marker[]>([]);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    eventMarkersRef.current.forEach((marker) => marker.remove());
    eventMarkersRef.current = [];

    const currentBounds = bounds || L.latLngBounds(EVENTS.map((e) => e.latlng));
    const visibleEvents = EVENTS.filter((event) =>
      event.isVisible(currentBounds, layout.startMilliseconds, layout.endMilliseconds),
    );

    visibleEvents.forEach((event) => {
      const icon = L.divIcon({
        className: "event-marker",
        html: `<div class=""></div>`,
        iconSize: [22, 22],
        iconAnchor: [14, 14],
      });
      const marker = L.marker(event.latlng, { icon })
        .addTo(mapInstance.current!)
        .bindPopup(event.title);
      eventMarkersRef.current.push(marker);
    });
  }, [bounds]);

  const eventBadges = EVENTS.flatMap((e) => e.badges);
  const visibleEventBadges = eventBadges.filter(
    (badge) =>
      badge.end.epochMilliseconds > layout.startMilliseconds &&
      badge.start.epochMilliseconds < layout.endMilliseconds,
  );

  const p = 4;
  const h = 22;
  return (
    <main className="h-[calc(100dvh-40px-4px-22px-4px-22px-4px-22px-4px)]">
      <div ref={mapRef} className="w-full h-full select-none" />
      <div
        ref={containerRef}
        className={`w-full h-[${3 * h + 4 * p}px] overflow-hidden select-none cursor-grab border-solid border-gray-300 dark:border-gray-700`}
        style={{
          touchAction: "none",
          willChange: "transform",
        }}
        onClick={handleTimelineClick}
      >
        <svg
          width={getVisibleWidth()}
          height={3 * h + 4 * p}
          className="block"
          style={{ backgroundColor: "transparent" }}
        >
          {visibleEventBadges.map((badge) => (
            <foreignObject
              key={badge.id}
              x={badge.x(layout.startMilliseconds, layout.ppd)}
              y={p}
              width={badge.width(layout.ppd)}
              height={h}
            >
              <div className="w-full h-full flex items-center justify-center">
                <Badge className="flex w-full h-full bg-green-300 text-transparent border-[3px] border-green-600 box-border box-border rounded-full dark:border-gray-100 dark:bg-green-600">
                  {badge.label(layout.ppd)}
                </Badge>
              </div>
            </foreignObject>
          ))}

          {layout.bottom.map((badge) => (
            <foreignObject
              key={badge.id}
              x={badge.x(layout.startMilliseconds, layout.ppd)}
              y={2 * p + h}
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
                  {badge.label(layout.ppd)}
                </Badge>
              </div>
            </foreignObject>
          ))}

          {layout.top.map((badge) => (
            <foreignObject
              key={badge.id}
              x={badge.x(layout.startMilliseconds, layout.ppd)}
              y={3 * p + 2 * h}
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
                  {badge.label(layout.ppd)}
                </Badge>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
    </main>
  );
}
