import { useEffect, useRef, useState } from "react"
import { MapMarker } from "react-native-maps"

// How long the view is left tracking before it is frozen. Android gives up well
// before this on its own (see below), so this is really just the point at which
// we stop asking.
const SETTLE_MS = 400

// When to force the icon to refresh after the contents change.
//
// One delay cannot be right for every device. Short enough to get a label on
// screen promptly on a fast phone is not long enough for react-native-svg and
// the text to have painted on a loaded emulator — and a capture taken before
// they have is exactly what freezes a half-drawn pin. Since each pass costs one
// small bitmap, doing it more than once is cheaper than guessing: the first
// usually lands, and the later ones are there for when layout ran long.
//
// If a device still shows a half-drawn pin, add another entry rather than
// stretching the window — tracking is not what is doing the work here.
const REDRAW_AT_MS = [SETTLE_MS, 1200]

/**
 * When a custom `Marker` may stop tracking its view, and how it is made to
 * paint one last time before it does.
 *
 * react-native-maps re-rasterises a custom marker view on every frame while
 * `tracksViewChanges` is on, which is ruinous with hundreds of pins on screen —
 * but it has to stay on long enough for the contents to paint once, or Android
 * snapshots a blank marker. `appearance` is whatever determines the marker's
 * pixels — a colour, a glyph name, a count, a label — and every custom marker on
 * this map goes through here so the two do not drift apart.
 *
 * The `redraw()` is not belt-and-braces. Android's `MapMarker` does not simply
 * honour the prop: it keeps an `updated` counter, bumped when the view lays out,
 * and `ViewChangesTracker` re-captures only while that counter is above zero,
 * decrementing on each pass. A couple of frames after the view changes the
 * counter reaches zero, the marker drops itself from the tracker and sets its
 * own `tracksViewChangesActive` to false — regardless of what the prop still
 * says. Two things follow, and both bite exactly when a name arrives for a pin
 * that has already settled:
 *
 *  - the window is really ~2 frames, not `SETTLE_MS`, so a label that has not
 *    finished laying out by then is captured half-drawn and frozen that way;
 *  - the library's own "render one more time to avoid race conditions" fallback
 *    is inside `updateTracksViewChanges`, behind an early return that trips
 *    whenever the native side already deactivated itself. It never runs for us.
 *
 * `redraw()` posts an unconditional `updateMarkerIcon()` to the main looper,
 * which is the only way back once the counter has run out — hence the schedule
 * above rather than a single delay chosen to be long enough for the slowest
 * device we can imagine.
 *
 * None of this costs anything on iOS: the Apple Maps path renders marker views
 * live and ignores `tracksViewChanges` entirely. It would matter under
 * `PROVIDER_GOOGLE`, which honours the prop by re-rendering every frame — so if
 * this map ever moves to Google Maps on iOS, check what the window costs there
 * before lengthening it.
 */
export const useMarkerSettle = (appearance: string) => {
  const markerRef = useRef<MapMarker>(null)
  const [tracksViewChanges, setTracksViewChanges] = useState(true)

  useEffect(() => {
    setTracksViewChanges(true)

    const settle = setTimeout(() => setTracksViewChanges(false), SETTLE_MS)
    // Each of these captures whatever has painted by then, whether or not the
    // native tracker is still listening.
    const redraws = REDRAW_AT_MS.map((delay) =>
      setTimeout(() => markerRef.current?.redraw(), delay),
    )

    return () => {
      clearTimeout(settle)
      for (const redraw of redraws) clearTimeout(redraw)
    }
  }, [appearance])

  return { markerRef, tracksViewChanges }
}
