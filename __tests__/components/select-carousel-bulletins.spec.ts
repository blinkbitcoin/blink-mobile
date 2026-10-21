import {
  Bulletin,
  INDICATOR_BAR,
  indicatorBarWidth,
  selectCarouselBulletins,
} from "@app/components/notifications/select-carousel-bulletins"

const CUTOFF = 1_800_000_000

const bulletin = (id: string, createdAt: number, dismissible = true): Bulletin => ({
  __typename: "StatefulNotification",
  id,
  title: id,
  body: "",
  createdAt,
  acknowledgedAt: null,
  bulletinEnabled: true,
  dismissible,
  icon: null,
  action: null,
})

const select = (bulletins: Bulletin[], isPersistenceOn = true) =>
  selectCarouselBulletins({ bulletins, isPersistenceOn, shownSince: CUTOFF }).map(
    ({ bulletin: { id }, canClose }) => ({ id, canClose }),
  )

describe("selectCarouselBulletins", () => {
  it("sorts newest first, whatever order the server sent", () => {
    expect(
      select([
        bulletin("b", CUTOFF + 2),
        bulletin("c", CUTOFF + 1),
        bulletin("a", CUTOFF + 3),
      ]),
    ).toEqual([
      { id: "a", canClose: true },
      { id: "b", canClose: true },
      { id: "c", canClose: true },
    ])
  })

  it("keeps a closable bulletin sent exactly at the cutoff and drops one sent before it", () => {
    expect(select([bulletin("at", CUTOFF), bulletin("before", CUTOFF - 1)])).toEqual([
      { id: "at", canClose: true },
    ])
  })

  it("exempts a bulletin the user cannot close from the cutoff and sorts it by date", () => {
    expect(
      select([
        bulletin("closable", CUTOFF + 10),
        bulletin("pinned", CUTOFF - 10, false),
        bulletin("hidden", CUTOFF - 5),
      ]),
    ).toEqual([
      { id: "closable", canClose: true },
      { id: "pinned", canClose: false },
    ])
  })

  it("reads every bulletin as closable with persistence off, so the cutoff applies to all", () => {
    expect(
      select(
        [bulletin("old", CUTOFF - 1, false), bulletin("new", CUTOFF + 1, false)],
        false,
      ),
    ).toEqual([{ id: "new", canClose: true }])
  })

  it("does not reorder the list it was given", () => {
    const input = [bulletin("older", CUTOFF + 1), bulletin("newer", CUTOFF + 2)]

    select(input)

    expect(input.map(({ id }) => id)).toEqual(["older", "newer"])
  })
})

describe("indicatorBarWidth", () => {
  it("draws no bars for one card or none", () => {
    expect(indicatorBarWidth(0, 360)).toBe(0)
    expect(indicatorBarWidth(1, 360)).toBe(0)
  })

  it("draws full-width bars when they fit", () => {
    expect(indicatorBarWidth(2, 360)).toBe(INDICATOR_BAR.width)
  })

  it("shrinks the bars to fit the row", () => {
    // 10 bars and 9 gaps of 2 in 168: (168 - 18) / 10 = 15
    expect(indicatorBarWidth(10, 168)).toBe(15)
  })

  it("never shrinks a bar below the minimum, even when the row overflows", () => {
    expect(indicatorBarWidth(40, 168)).toBe(INDICATOR_BAR.minWidth)
  })
})
