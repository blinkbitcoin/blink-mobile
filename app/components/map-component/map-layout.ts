// Geometry the controls drawn over the map share, kept out of any one of them so
// none has to import its layout from a sibling.

/** The gap every map control keeps to the edge it sits against. */
export const MAP_CONTROL_INSET = 20

/** The search field and the filter button beside it are both this tall. */
export const SEARCH_BAR_HEIGHT = 44

/** Where the search bar ends, for anything else that has to be drawn under it. */
export const searchBarBottom = (topInset: number): number =>
  topInset + MAP_CONTROL_INSET + SEARCH_BAR_HEIGHT
