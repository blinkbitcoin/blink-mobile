/**
 * The gap every control floating over the map keeps from the map's edges.
 *
 * One number in one place because the controls are drawn by three different
 * components — the search bar and its filter, the add-place pill, and the
 * centre button — and nothing short of a shared constant keeps their insets
 * equal. They were 12, 8 and 8 before this, which is what made them look
 * scattered rather than set on one margin.
 */
export const MAP_EDGE_GAP = 20
