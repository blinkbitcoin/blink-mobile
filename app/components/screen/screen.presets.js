/**
 * All screen keyboard offsets.
 */
export var offsets = {
    none: 0,
    navigationHeader: 100,
};
/**
 * All the variations of screens.
 */
export var presets = {
    /**
     * No scrolling. Suitable for full-screen carousels and components
     * which have built-in scrolling like FlatList.
     */
    fixed: {
        outer: {
            flex: 1,
            height: "100%",
        },
        inner: {
            justifyContent: "flex-start",
            alignItems: "stretch",
            height: "100%",
            width: "100%",
        },
    },
    /**
     * Scrolls. Suitable for forms or other things requiring a keyboard.
     *
     * Pick this one if you don't know which one you want yet.
     */
    scroll: {
        outer: {
            flex: 1,
            height: "100%",
        },
        inner: { justifyContent: "flex-start", alignItems: "stretch" },
    },
};
/**
 * Is this preset a non-scrolling one?
 *
 * @param preset The preset to check
 */
export function isNonScrolling(preset) {
    // any of these things will make you scroll
    return !preset || !preset.length || !presets[preset] || preset === "fixed";
}
//# sourceMappingURL=screen.presets.js.map