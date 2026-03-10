import { useEffect, useRef, useState, useCallback } from 'react'
import { useDrag, useWheel } from '@use-gesture/react'
import { Badge } from '@/components/ui/badge'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_ZOOM = 0
const MAX_ZOOM = 4
const LAT_LONG_GOE = [51.541, 9.936]

type BadgeLabel = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | 'DAYTIME' | 'HOURS'

interface ZoomLevel {
  top: BadgeLabel
  bottom: BadgeLabel
  ppd: number
}

const ZOOM_LEVELS: ZoomLevel[] = [
  { top: "YEAR", bottom: "MONTH", ppd: 1.5 },
  { top: "MONTH", bottom: "WEEK", ppd: 8 },
  { top: "WEEK", bottom: "DAY", ppd: 50 },
  { top: "DAY", bottom: "DAYTIME", ppd: 350 },
  { top: "DAYTIME", bottom: "HOURS", ppd: 900 },
]


interface LabelConfig {
  getStart: (d: Date) => number
  getEnd: (d: Date) => number
  advance: (d: Date) => void
  format: (d: Date, row: string) => string
  getPeriodLength: (d: Date) => number
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const LABEL_CONFIGS: Record<BadgeLabel, LabelConfig> = {
  YEAR: {
    getStart: (d) => new Date(d.getFullYear(), 0, 1).getTime(),
    getEnd: (d) => new Date(d.getFullYear() + 1, 0, 1).getTime(),
    advance: (d) => d.setFullYear(d.getFullYear() + 1, 0, 1),
    format: (d) => String(d.getFullYear()),
    getPeriodLength: (d) => {
      const year = d.getFullYear()
      return (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / MS_PER_DAY
    },
  },
  MONTH: {
    getStart: (d) => new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    getEnd: (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
    advance: (d) => d.setMonth(d.getMonth() + 1, 1),
    format: (d, row) => row == "top" ? d.toLocaleString('default', { month: 'long', year: "numeric" }) : d.toLocaleString('default', { month: 'short' }),
    getPeriodLength: (d) => {
      return (new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - new Date(d.getFullYear(), d.getMonth(), 1).getTime()) / MS_PER_DAY
    },
  },
  WEEK: {
    getStart: (d) => {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
      return new Date(d.getFullYear(), d.getMonth(), diff).getTime()
    },
    getEnd: (d) => new Date(d.getTime() + 7 * MS_PER_DAY).getTime(),
    advance: (d) => {
      d.setDate(d.getDate() + 7)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
    },
    format: (d) => `KW${getWeekNumber(d)}`,
    getPeriodLength: () => 7,
  },
  DAY: {
    getStart: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
    getEnd: (d) => new Date(d.getTime() + MS_PER_DAY).getTime(),
    advance: (d) => d.setDate(d.getDate() + 1),
    format: (d, row) => row == "top" ? d.toLocaleDateString('default', { weekday: 'long' }) : d.toLocaleDateString('default', { weekday: 'short' }),
    getPeriodLength: () => 1,
  },
  DAYTIME: {
    // Round down to nearest 6-hour boundary (0, 6, 12, 18)
    getStart: (d) => {
      const hour = Math.floor(d.getHours() / 6) * 6
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime()
    },

    // 6 hours later
    getEnd: (d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(d.getHours() / 6) * 6)
      return start.getTime() + 6 * 60 * 60 * 1000
    },

    // Simply add 6 hours - no special day-crossing logic needed
    advance: (d) => {
      d.setHours(Math.floor(d.getHours() / 6) * 6 + 6, 0, 0, 0)
    },

    // Label based on the period start hour
    format: (d) => {
      const periodStart = Math.floor(d.getHours() / 6) * 6
      if (periodStart == 0) return 'Nacht'
      if (periodStart == 6) return 'Morgen'
      if (periodStart == 12) return 'Nachmittag'
      return 'Abend'
    },

    getPeriodLength: () => 6 / 24,
  },
  HOURS: {
    getStart: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime(),
    getEnd: (d) => new Date(d.getTime() + 60 * 60 * 1000).getTime(),
    advance: (d) => d.setHours(d.getHours() + 1),
    format: (d) => d.getHours().toString().padStart(2, '0'),
    getPeriodLength: () => 1 / 24,
  },
}


interface BadgeSpan {
  x: number
  width: number
  label: string
  isPast: boolean
  isFuture: boolean
  startTime: number
  endTime: number
}

interface Layout {
  top: BadgeSpan[]
  bottom: BadgeSpan[]
}


function generateBadges(
  row: string,
  label: BadgeLabel,
  start: Date,
  end: Date,
  msToX: (ms: number) => number,
  now: number,
  ppd: number,
): BadgeSpan[] {
  const config = LABEL_CONFIGS[label]
  const badges: BadgeSpan[] = []
  const currentDate = new Date(start.getTime())
  while (true) {
    const periodStart = config.getStart(currentDate)
    const periodEnd = config.getEnd(currentDate)
    if (periodStart > end.getTime()) {
      break
    }
    badges.push({
      x: msToX(periodStart),
      width: config.getPeriodLength(currentDate) * ppd,
      label: config.format(currentDate, row),
      isPast: periodEnd < now,
      isFuture: periodStart > now,
      startTime: periodStart,
      endTime: periodEnd,
    })
    config.advance(currentDate)
  }
  return badges
}

function getVisibleRange(centerTime: Date, zoom: number, pxPerViewport: number): { start: Date; end: Date, totalMs: number } {
  const center = centerTime.getTime()
  const pxPerDay = ZOOM_LEVELS[zoom].ppd;
  const msPerPx = MS_PER_DAY / pxPerDay;
  const totalMs = pxPerViewport * msPerPx;
  return {
    start: new Date(center - totalMs / 2),
    end: new Date(center + totalMs / 2),
    totalMs: totalMs,
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)

  const timeline = useRef({
    center: new Date(),
    zoom: 0,
  })

  const map = useRef({
    center: LAT_LONG_GOE,
    zoom: 13
  })

  const initialCenterTime = useRef(new Date())

  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate((n) => n + 1), [])

  useEffect(() => {
    const handleResize = () => rerender()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [rerender])

  useEffect(() => {
    requestAnimationFrame(() => rerender())
  }, [rerender])

  const getVisibleWidth = useCallback(() => {
    return containerRef.current?.clientWidth
  }, [])

  const computeLayout = useCallback((): Layout => {
    const width = getVisibleWidth()
    if (!width) return { top: [], bottom: [] };
    const { center, zoom } = timeline.current
    const z = ZOOM_LEVELS[zoom]
    const { start, end, totalMs } = getVisibleRange(center, zoom, width)
    const now = Date.now()
    const msToX = (ms: number) => {
      const ratio = (ms - start.getTime()) / totalMs
      return ratio * width
    }
    const top: BadgeSpan[] = generateBadges("top", z.top, start, end, msToX, now, z.ppd);
    const bottom: BadgeSpan[] = generateBadges("bottom", z.bottom, start, end, msToX, now, z.ppd);
    return { top, bottom }
  }, [getVisibleWidth])

  const bindDrag = useDrag(({ down, movement: [mx] }) => {
    if (!down) {
      initialCenterTime.current = new Date(timeline.current.center.getTime())
      return
    }
    const width = getVisibleWidth()
    if (!width) return;
    const { totalMs } = getVisibleRange(initialCenterTime.current, timeline.current.zoom, width)
    const msPerPixel = totalMs / width
    const timeDelta = -mx * msPerPixel
    timeline.current.center = new Date(initialCenterTime.current.getTime() + timeDelta)
    rerender()
  })

  const lastZoomTime = useRef(0)
  const COOLDOWN_MS = 200
  const bindWheel = useWheel(({ delta: [, dy] }) => {
    if (dy === 0) return
    const now = Date.now()
    if (now - lastZoomTime.current < COOLDOWN_MS) return
    lastZoomTime.current = now
    const direction = dy > 0 ? -1 : 1
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, timeline.current.zoom + direction))
    timeline.current.zoom = newZoom
    rerender()
  })

  const lastClickTime = useRef(0)
  const DOUBLE_CLICK_DELAY = 300
  const handleTimelineClick = () => {
    const now = Date.now()

    if (now - lastClickTime.current < DOUBLE_CLICK_DELAY) {
      // Double click - center on present
      timeline.current.center = new Date()
      initialCenterTime.current = new Date()
      rerender()
    }

    lastClickTime.current = now
  }

  const lastTouchX = useRef(0)
  const lastTouchY = useRef(0)
  const isTouchDragging = useRef(false)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      isTouchDragging.current = false

      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
        isTouchDragging.current = true
        initialCenterTime.current = new Date(timeline.current.center.getTime())
        lastTouchX.current = touchStartX
        lastTouchY.current = touchStartY
      } else if (e.touches.length === 2) {
        isTouchDragging.current = false
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchDragging.current && e.touches.length === 1) {
        const touchX = e.touches[0].clientX
        const touchY = e.touches[0].clientY
        const xDiff = Math.abs(touchX - touchStartX)
        const yDiff = Math.abs(touchY - touchStartY)

        if (xDiff < 10 && yDiff < 10) return

        if (xDiff > yDiff) {
          if (e.cancelable) e.preventDefault()
          const width = getVisibleWidth()
          if (!width) return;
          const { totalMs } = getVisibleRange(timeline.current.center, timeline.current.zoom, width)
          const offset = touchX - touchStartX
          const msPerPixel = totalMs / width
          const timeDelta = -offset * msPerPixel
          timeline.current.center = new Date(initialCenterTime.current.getTime() + timeDelta)
          rerender()
          return
        }

        isTouchDragging.current = false
        const direction = touchStartY - touchY
        const newZoom = direction < 0
          ? Math.min(MAX_ZOOM, timeline.current.zoom + 1)
          : Math.max(MIN_ZOOM, timeline.current.zoom - 1)
        if (newZoom === timeline.current.zoom) return
        const rect = container.getBoundingClientRect()
        const cursorRatio = (touchX - rect.left) / rect.width
        const width = getVisibleWidth()
        if (!width) return;
        const { start, totalMs } = getVisibleRange(timeline.current.center, timeline.current.zoom, width)
        const cursorMs = start.getTime() + cursorRatio * totalMs
        timeline.current.zoom = newZoom
        const newRange = getVisibleRange(timeline.current.center, newZoom, width)
        const newCursorRatio = (cursorMs - newRange.start.getTime()) / newRange.totalMs
        timeline.current.center = new Date(cursorMs - newCursorRatio * newRange.totalMs + newRange.totalMs / 2)
        rerender()
      }
    }

    const handleTouchEnd = () => {
      isTouchDragging.current = false
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [getVisibleWidth, rerender])

  const layout = computeLayout()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    mapInstance.current = L.map(mapRef.current, {
      center: map.current.center as L.LatLngTuple,
      zoom: map.current.zoom,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapInstance.current)
    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [map.current.center, map.current.zoom])

  return (
    <main className="h-[calc(100dvh-48px-64px)]">
      <div
        ref={containerRef}
        className="w-full h-[64px] overflow-hidden select-none cursor-grab pt-2"
        style={{
          touchAction: 'none',
          backgroundColor: 'var(--card)',
        }}
        onClick={handleTimelineClick}
        {...bindDrag()}
        {...bindWheel()}
      >
        <svg width={getVisibleWidth()} height={64} className="block" style={{ backgroundColor: 'transparent' }}>
          {layout.top.map((badge, i) => (
            <foreignObject key={`${badge.startTime}-${badge.endTime}`} x={badge.x} y={0} width={Math.max(badge.width, 1)} height={24}>
              <div className="w-full h-full flex items-center justify-center">
                <Badge variant={badge.isPast ? 'past' : badge.isFuture ? 'future' : 'present'} className="flex w-full">
                  {badge.label}
                </Badge>
              </div>
            </foreignObject>
          ))}

          {layout.bottom.map((badge, i) => (
            <foreignObject key={`bottom-${i}`} x={badge.x} y={30} width={Math.max(badge.width, 1)} height={24}>
              <div className="w-full h-full flex items-center justify-center">
                <Badge variant={badge.isPast ? 'past' : badge.isFuture ? 'future' : 'present'} className="flex w-full">
                  {badge.label}
                </Badge>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
      <div ref={mapRef} className="w-full h-full select-none" />
    </main>
  )
}
