import { useEffect, useRef, useState } from "react"
import { MapMarker } from "react-native-maps"

// Long enough for react-native-svg and the label's text to paint the marker's
// contents once.
const SETTLE_MS = 400

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
 * `redraw()` posts a single unconditional `updateMarkerIcon()` to the main
 * looper, which is the only way back once the counter has run out.
 */
export const useMarkerSettle = (appearance: string) => {
  const markerRef = useRef<MapMarker>(null)
  const [tracksViewChanges, setTracksViewChanges] = useState(true)

  useEffect(() => {
    setTracksViewChanges(true)

    const timer = setTimeout(() => {
      setTracksViewChanges(false)
      // By now the contents have painted, so this captures them whether or not
      // the native tracker was still listening.
      markerRef.current?.redraw()
    }, SETTLE_MS)

    return () => clearTimeout(timer)
  }, [appearance])

  return { markerRef, tracksViewChanges }
}
