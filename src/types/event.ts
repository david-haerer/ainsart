import type { Temporal } from "@js-temporal/polyfill";

export interface EventLocation {
  lat: number;
  lng: number;
  name: string;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: EventLocation;
  participants: string[];
}

export interface EventWithTemporal extends Event {
  startZdt: Temporal.ZonedDateTime;
  endZdt: Temporal.ZonedDateTime;
}

export interface VisibleEventsConfig {
  mapBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  timelineStart: Temporal.ZonedDateTime;
  timelineEnd: Temporal.ZonedDateTime;
}

export function parseEventDates(
  event: Event,
  Temporal: typeof import("@js-temporal/polyfill").Temporal,
): EventWithTemporal {
  // Parse ISO datetime strings by first converting to Instant, then to ZonedDateTime
  const startInstant = Temporal.Instant.from(event.startTime);
  const endInstant = Temporal.Instant.from(event.endTime);
  const timeZone = Temporal.Now.timeZoneId();

  return {
    ...event,
    startZdt: startInstant.toZonedDateTimeISO(timeZone),
    endZdt: endInstant.toZonedDateTimeISO(timeZone),
  };
}

export function isEventInViewport(
  event: EventWithTemporal,
  config: VisibleEventsConfig,
): boolean {
  // Check time overlap
  const timeOverlap =
    event.startZdt.epochMilliseconds < config.timelineEnd.epochMilliseconds &&
    event.endZdt.epochMilliseconds > config.timelineStart.epochMilliseconds;

  if (!timeOverlap) return false;

  // Check map bounds if available
  if (config.mapBounds) {
    const { north, south, east, west } = config.mapBounds;
    const inBounds =
      event.location.lat <= north &&
      event.location.lat >= south &&
      event.location.lng <= east &&
      event.location.lng >= west;

    if (!inBounds) return false;
  }

  return true;
}

export function getEventDuration(event: EventWithTemporal): number {
  return event.endZdt.epochMilliseconds - event.startZdt.epochMilliseconds;
}

export function getEventXPosition(
  event: EventWithTemporal,
  timelineStartMs: number,
  pixelsPerDay: number,
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const pxPerMs = pixelsPerDay / msPerDay;
  const msFromStart = event.startZdt.epochMilliseconds - timelineStartMs;
  return pxPerMs * msFromStart;
}

export function getEventWidth(
  event: EventWithTemporal,
  pixelsPerDay: number,
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const pxPerMs = pixelsPerDay / msPerDay;
  const duration = getEventDuration(event);
  return pxPerMs * duration;
}
