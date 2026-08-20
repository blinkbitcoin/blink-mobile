// Which merchant names can be drawn without landing on top of each other.
//
// btcmap.org gets this for free: its labels are a MapLibre symbol layer, and
// MapLibre's placement pass drops any label whose box hits one already placed,
// every frame, fading them in and out as the map moves. We are on Google and
// Apple Maps through react-native-maps, where every label is a separate native
// view rasterised to a bitmap and nothing arbitrates between them — so the pass
// is done here, in screen space, and the callers render only what it returns.
//
// Deliberately pure and free of react-native-maps: given a region and the size
// of the view drawn from it, everything below is arithmetic, which is what makes
// the placement testable without a map on screen.

import { BtcMapPlace } from "@app/btcmap"

import {
  LABEL_FONT_SIZE,
  LABEL_HALO_PADDING,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
  LABEL_OFFSET_X,
  LABEL_OFFSET_Y,
} from "./marker-layout"

/** The size of the map view, in the same dp the marker geometry is in. */
export type Viewport = { width: number; height: number }

export type ScreenPoint = { x: number; y: number }

/** Screen-space bounds, y growing downwards. */
export type Box = { left: number; top: number; right: number; bottom: number }

type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

type Coordinate = { latitude: number; longitude: number }

/**
 * What the map is showing and how big it is showing it — the two halves of a
 * projection, which are only ever meaningful together.
 */
export type MapFrame = { region: Region; viewport: Viewport }

// Web Mercator is undefined at the poles and the basemaps stop here anyway.
const MAX_MERCATOR_LATITUDE = 85.051129

const clampLatitude = (latitude: number): number =>
  Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude))

/**
 * The Mercator ordinate for a latitude.
 *
 * The map is drawn in Mercator, in which latitude is not linear in screen space
 * — so interpolating a pin's y between the region's north and south edges
 * directly would place it slightly wrong, by more the further the viewport
 * reaches from the equator. Converting both edges and the point into this first
 * is what keeps a label's box over the pin it belongs to.
 */
const mercatorY = (latitude: number): number =>
  Math.log(Math.tan(Math.PI / 4 + (clampLatitude(latitude) * Math.PI) / 360))

/**
 * A longitude difference, brought back into ±180°.
 *
 * A viewport sitting on the antimeridian has a western edge past -180°, and a
 * place just inside its eastern half is at +179-something: subtracting them
 * gives ~360° and would throw a pin that is on screen far off it. Only the
 * shortest way round is ever meaningful here, so that is what is taken —
 * genuinely distant places still land outside the viewport and get culled.
 */
const shortestLongitudeDelta = (degrees: number): number =>
  ((((degrees + 540) % 360) + 360) % 360) - 180

/** Where a coordinate falls in the view the frame describes. */
export const projectToScreen = (
  place: Coordinate,
  { region, viewport }: MapFrame,
): ScreenPoint => {
  const west = region.longitude - region.longitudeDelta / 2
  const north = mercatorY(region.latitude + region.latitudeDelta / 2)
  const south = mercatorY(region.latitude - region.latitudeDelta / 2)

  const x =
    (shortestLongitudeDelta(place.longitude - west) / region.longitudeDelta) *
    viewport.width
  const y = ((north - mercatorY(place.latitude)) / (north - south)) * viewport.height

  return { x, y }
}

// Per-character advance as a fraction of the font size, for the label's 12dp
// semibold system face.
//
// Measuring the real thing means laying every name out off-screen, which costs
// more than the placement it would inform; three buckets get within a few
// percent, which the halo padding around each box then covers. What is left of
// the error is spent in the safe direction anyway: a box estimated too wide
// hides a label that would have fitted, where one estimated too narrow puts two
// names on top of each other — the thing this module exists to prevent.
const NARROW_CHARACTERS = new Set(" .,:;'\"`|!ijlt()[]{}/\\-".split(""))
// The ellipsis `truncateLabel` appends is nearly an em wide in the system face,
// so it belongs here rather than taking the default: a shortened name is exactly
// the case where the estimate must not come out under the pixels.
const WIDE_CHARACTERS = new Set("mwMW@%\u2026".split(""))
const NARROW_RATIO = 0.32
const WIDE_RATIO = 0.92
const UPPERCASE_RATIO = 0.66
const DEFAULT_RATIO = 0.55

/**
 * A character that has a lower case and is not in it — which is the only test
 * that holds across the scripts the names arrive in. Scripts without case at all
 * (Arabic, Thai, the CJK ranges) answer false and take the default, which is the
 * right bucket for them: they have no wider capital form to account for.
 */
const isUpperCase = (character: string): boolean => character !== character.toLowerCase()

const characterWidth = (character: string): number => {
  if (NARROW_CHARACTERS.has(character)) return NARROW_RATIO
  if (WIDE_CHARACTERS.has(character)) return WIDE_RATIO
  if (isUpperCase(character)) return UPPERCASE_RATIO
  return DEFAULT_RATIO
}

/**
 * How wide a name draws, in dp.
 *
 * Clamped to the width the label view is allowed to reach, past which the text
 * is ellipsised rather than run on — so for a long name this stops being an
 * estimate and becomes the exact width.
 */
export const estimateLabelWidth = (name: string): number => {
  const ems = [...name].reduce((total, character) => total + characterWidth(character), 0)

  return Math.min(ems * LABEL_FONT_SIZE, LABEL_MAX_WIDTH)
}

/**
 * The screen-space rectangle a name would occupy, halo included.
 *
 * The pin itself is not in this box and never collides — btcmap.org marks its
 * pins `icon-allow-overlap` for the same reason. A pin is the data; a name is a
 * convenience. Dropping pins to make room for text would hide merchants, so
 * only text competes with text, and a name is allowed to cross a neighbouring
 * pin.
 */
export const labelBox = (place: Coordinate, name: string, frame: MapFrame): Box => {
  const { x, y } = projectToScreen(place, frame)

  const left = x + LABEL_OFFSET_X - LABEL_HALO_PADDING
  const middle = y + LABEL_OFFSET_Y

  return {
    left,
    right: left + estimateLabelWidth(name) + LABEL_HALO_PADDING * 2,
    top: middle - LABEL_LINE_HEIGHT / 2 - LABEL_HALO_PADDING,
    bottom: middle + LABEL_LINE_HEIGHT / 2 + LABEL_HALO_PADDING,
  }
}

export const boxesIntersect = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

// Buckets for the overlap test. A box can be wider than this and simply spans
// several, so the size only trades memory against comparisons rather than
// changing the answer.
const GRID_CELL = 64

const cellsFor = (box: Box): string[] => {
  const firstColumn = Math.floor(box.left / GRID_CELL)
  const lastColumn = Math.floor(box.right / GRID_CELL)
  const firstRow = Math.floor(box.top / GRID_CELL)
  const lastRow = Math.floor(box.bottom / GRID_CELL)

  const keys: string[] = []
  for (let column = firstColumn; column <= lastColumn; column += 1) {
    for (let row = firstRow; row <= lastRow; row += 1) {
      keys.push(`${column}:${row}`)
    }
  }
  return keys
}

/**
 * The boxes placed so far, bucketed by the cells they touch, so testing a
 * candidate costs the boxes near it rather than every box already placed.
 */
const createBoxGrid = () => {
  const cells = new Map<string, Box[]>()

  return {
    collides: (box: Box): boolean =>
      cellsFor(box).some((key) =>
        (cells.get(key) ?? []).some((occupant) => boxesIntersect(box, occupant)),
      ),

    insert: (box: Box): void => {
      cellsFor(box).forEach((key) => {
        const occupants = cells.get(key)
        if (occupants) occupants.push(box)
        else cells.set(key, [box])
      })
    },
  }
}

type Candidate = { id: number; box: Box; rank: number }

/**
 * The named places that are near enough to the middle of the screen to be worth
 * placing, nearest first.
 *
 * A name entirely off screen cannot be read and must not take the place of one
 * that can, so it is dropped here. Anything still touching an edge stays in —
 * a label half off screen still has to stop a second label landing on the half
 * that shows.
 */
const rankedCandidates = (
  places: readonly BtcMapPlace[],
  names: ReadonlyMap<number, string>,
  frame: MapFrame,
): Candidate[] => {
  const { width, height } = frame.viewport
  const screen: Box = { left: 0, top: 0, right: width, bottom: height }

  const candidates = places.flatMap((place) => {
    const name = names.get(place.id)
    if (!name) return []

    const box = labelBox(place, name, frame)
    if (!boxesIntersect(box, screen)) return []

    const dx = (box.left + box.right) / 2 - width / 2
    const dy = (box.top + box.bottom) / 2 - height / 2
    return [{ id: place.id, box, rank: dx * dx + dy * dy }]
  })

  // Ties go to the lower id purely so the result does not depend on the order
  // the places arrived in.
  return candidates.sort((a, b) => a.rank - b.rank || a.id - b.id)
}

/**
 * The places whose names can be drawn, taken greedily from the middle of the
 * screen out.
 *
 * Nearest the centre wins, which is the same order `usePlaceClusters` drops pins
 * in when it hits its render cap: both then degrade in the same direction, away
 * from where the user is looking, and a pan that changes which names fit changes
 * them at the edges rather than shuffling the ones being read.
 *
 * Runs once per settled camera, not per frame — `region` only advances on
 * `onRegionChangeComplete` — so unlike MapLibre's placement this cannot fade
 * anything in. Names resolve when the map comes to rest.
 */
export const placeLabels = (
  places: readonly BtcMapPlace[],
  names: ReadonlyMap<number, string>,
  frame: MapFrame,
): ReadonlySet<number> => {
  const visible = new Set<number>()
  if (frame.viewport.width <= 0 || frame.viewport.height <= 0) return visible

  const grid = createBoxGrid()
  rankedCandidates(places, names, frame).forEach((candidate) => {
    if (grid.collides(candidate.box)) return
    grid.insert(candidate.box)
    visible.add(candidate.id)
  })

  return visible
}
