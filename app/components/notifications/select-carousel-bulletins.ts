import { BulletinsQuery } from "@app/graphql/generated"

export type Bulletin = NonNullable<
  BulletinsQuery["me"]
>["unacknowledgedStatefulNotificationsWithBulletinEnabled"]["edges"][number]["node"]

export type ShownBulletin = { bulletin: Bulletin; canClose: boolean }

type SelectArgs = {
  bulletins: readonly Bulletin[]
  /** With persistent bulletins switched off every bulletin reads as closable. */
  isPersistenceOn: boolean
  /** Unix seconds: closable bulletins sent before it are not shown. */
  shownSince: number
}

/**
 * The server bulletins the carousel shows, newest first by `createdAt`. A closable
 * bulletin sent before the release cutoff stays hidden, as the single-card home hid it
 * behind newer ones. A bulletin the user cannot close is exempt, since the home already
 * pins it, and sorts by date with the rest.
 */
export const selectCarouselBulletins = ({
  bulletins,
  isPersistenceOn,
  shownSince,
}: SelectArgs): ShownBulletin[] =>
  bulletins
    .map((bulletin) => ({
      bulletin,
      canClose: !isPersistenceOn || bulletin.dismissible,
    }))
    .filter(({ bulletin, canClose }) => !canClose || bulletin.createdAt >= shownSince)
    .sort((a, b) => b.bulletin.createdAt - a.bulletin.createdAt)

export const INDICATOR_BAR = { width: 20, minWidth: 10, height: 2, gap: 2 }

/** Width of each indicator bar: 20, shrunk to fit the available width, never below 10.
 *  0 when one card or none is shown, since then there are no bars. */
export const indicatorBarWidth = (count: number, availableWidth: number): number => {
  if (count <= 1) return 0
  const fitting = (availableWidth - INDICATOR_BAR.gap * (count - 1)) / count
  return Math.max(INDICATOR_BAR.minWidth, Math.min(INDICATOR_BAR.width, fitting))
}
