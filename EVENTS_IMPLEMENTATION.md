# Events Feature Implementation

## Overview

Successfully implemented an events system using Astro Content Collections with:

- Events stored as Markdown files with frontmatter
- Map markers showing events in viewport bounds
- Third timeline layer displaying events
- Profile pages showing artisan's events

## Files Created

### 1. Content Collection Configuration

**`src/content/config.ts`**

- Defines `events` collection schema
- Includes: title, startTime, endTime, location (lat/lng/name), participants array

### 2. Sample Event Files

**`src/content/events/handwerksmesse-2026.md`**
**`src/content/events/weihnachtsmarkt-2026.md`**

Example structure:

```yaml
---
title: "Handwerksmesse Göttingen"
startTime: "2026-05-15T09:00:00+02:00"
endTime: "2026-05-17T18:00:00+02:00"
location:
  lat: 51.541
  lng: 9.936
  name: "Stadthalle Göttingen"
participants:
  - david
---
Event description in Markdown...
```

### 3. Type Definitions

**`src/types/event.ts`**

- `Event` interface with all properties
- `EventWithTemporal` with parsed Temporal dates
- `VisibleEventsConfig` for viewport filtering
- Utility functions: `parseEventDates`, `isEventInViewport`, `getEventXPosition`, `getEventWidth`

### 4. React Components

**`src/components/EventMarker.tsx`**

- Renders Leaflet markers for events on the map
- Shows different colors for selected/unselected events
- Click handler to select event and center timeline

**`src/components/EventTimelineBar.tsx`**

- Renders event bars on the timeline (third layer)
- Calculates position and width based on event duration
- Visual indicator for selected events

### 5. Modified Files

**`src/pages/index.astro`**

- Imports events collection using `getCollection('events')`
- Passes events data to App component as props

**`src/components/App.tsx`**

- Accepts `events` prop
- Filters events by map bounds and timeline viewport
- Renders EventMarker components on map
- Renders EventTimelineBar components in third SVG layer
- Handles event selection state
- Centers timeline on selected event

**`src/layouts/profile.astro`**

- Fetches events where artisan is a participant
- Displays events section on profile page
- Shows event title, location, dates, and description

## Key Features

### Viewport-Based Filtering

Events are only shown when they meet BOTH criteria:

1. Within current map bounds (north/south/east/west)
2. Overlap with current timeline viewport (start to end time)

### Event Selection

- Click event marker on map → selects event, centers timeline, opens popup
- Click event bar on timeline → selects event
- Selected events highlighted in red

### Data Flow

1. Build time: Astro collects all `.md` files from `src/content/events/`
2. Validates against schema in `config.ts`
3. Makes available via `getCollection('events')`
4. Server renders page with events data embedded
5. React hydrates with events data as props
6. Map/timeline filter events based on viewport

## Testing

Run dev server:

```bash
bun run dev
```

Visit:

- http://localhost:4321/ - Main app with map and events
- http://localhost:4321/@david - Profile showing david's events

## Next Steps / Improvements

1. **Event Detail Pages**: Add `[...slug].astro` route to render individual event pages
2. **Event Creation UI**: Form to create new events (could write to .md files)
3. **Recurring Events**: Support for weekly/monthly recurring events
4. **Event Categories**: Add tags/types to events for filtering
5. **Search**: Search events by title, location, or participant
6. **Better Timeline Display**: Show event duration bars more prominently
7. **Mobile Optimization**: Better touch handling for event selection
