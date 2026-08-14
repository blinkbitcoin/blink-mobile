import { useEffect, useState } from "react"

// Long enough for react-native-svg to paint the marker's contents once.
const SETTLE_MS = 400

/**
 * When a custom `Marker` may stop tracking its view.
 *
 * react-native-maps re-rasterises a custom marker view on every frame while
 * `tracksViewChanges` is on, which is ruinous with hundreds of pins on screen —
 * but it has to stay on long enough for the SVG contents to paint once, or
 * Android snapshots a blank marker. Once it goes off, Android keeps serving
 * that cached bitmap (`MapMarker.updateTracksViewChanges` early-returns when
 * tracking is already off), so anything that changes what is drawn has to
 * re-open the window.
 *
 * `appearance` is whatever determines the marker's pixels — a colour, a glyph
 * name, a count. Every custom marker on this map goes through here so the two
 * do not drift apart.
 */
export const useMarkerSettle = (appearance: string): boolean => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true)

  useEffect(() => {
    setTracksViewChanges(true)
    const timer = setTimeout(() => setTracksViewChanges(false), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [appearance])

  return tracksViewChanges
}
