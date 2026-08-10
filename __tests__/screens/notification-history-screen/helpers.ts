import { Icon } from "@app/graphql/generated"

/**
 * An icon the backend can send but the app ships no asset for.
 *
 * Declared once so the guard in `utils.spec.ts`, which asserts it really is unmapped,
 * keeps every spec that renders it honest. Two copies could drift, and the day a rocket
 * asset lands only the copy next to the guard would notice.
 */
export const UNMAPPED_ICON = "ROCKET" as Icon
