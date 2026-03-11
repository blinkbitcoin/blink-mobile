import {
  testBulletinsStore,
  type TestBulletin,
} from "@app/components/notifications/test-bulletins-store"

const makeTestBulletin = (
  overrides: Partial<{ id: string; title: string }> = {},
): TestBulletin => ({
  id: overrides.id ?? "test-1",
  title: overrides.title ?? "Test Title",
  body: "Test Body",
  type: "none",
})

afterEach(() => {
  testBulletinsStore.clear()
})

describe("testBulletinsStore", () => {
  it("starts with an empty array", () => {
    expect(testBulletinsStore.getSnapshot()).toEqual([])
  })

  it("adds a bulletin", () => {
    const bulletin = makeTestBulletin()
    testBulletinsStore.add(bulletin)

    expect(testBulletinsStore.getSnapshot()).toEqual([bulletin])
  })

  it("adds multiple bulletins", () => {
    const b1 = makeTestBulletin({ id: "test-1" })
    const b2 = makeTestBulletin({ id: "test-2", title: "Second" })
    testBulletinsStore.add(b1)
    testBulletinsStore.add(b2)

    expect(testBulletinsStore.getSnapshot()).toEqual([b1, b2])
  })

  it("removes a bulletin by id", () => {
    const b1 = makeTestBulletin({ id: "test-1" })
    const b2 = makeTestBulletin({ id: "test-2" })
    testBulletinsStore.add(b1)
    testBulletinsStore.add(b2)

    testBulletinsStore.remove("test-1")

    expect(testBulletinsStore.getSnapshot()).toEqual([b2])
  })

  it("does nothing when removing non-existent id", () => {
    const b1 = makeTestBulletin()
    testBulletinsStore.add(b1)

    testBulletinsStore.remove("non-existent")

    expect(testBulletinsStore.getSnapshot()).toEqual([b1])
  })

  it("clears all bulletins", () => {
    testBulletinsStore.add(makeTestBulletin({ id: "test-1" }))
    testBulletinsStore.add(makeTestBulletin({ id: "test-2" }))

    testBulletinsStore.clear()

    expect(testBulletinsStore.getSnapshot()).toEqual([])
  })

  it("notifies subscribers on add", () => {
    const listener = jest.fn()
    testBulletinsStore.subscribe(listener)

    testBulletinsStore.add(makeTestBulletin())

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notifies subscribers on remove", () => {
    testBulletinsStore.add(makeTestBulletin({ id: "test-1" }))
    const listener = jest.fn()
    testBulletinsStore.subscribe(listener)

    testBulletinsStore.remove("test-1")

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notifies subscribers on clear", () => {
    testBulletinsStore.add(makeTestBulletin())
    const listener = jest.fn()
    testBulletinsStore.subscribe(listener)

    testBulletinsStore.clear()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("unsubscribes correctly", () => {
    const listener = jest.fn()
    const unsubscribe = testBulletinsStore.subscribe(listener)

    unsubscribe()
    testBulletinsStore.add(makeTestBulletin())

    expect(listener).not.toHaveBeenCalled()
  })

  it("returns a new array reference on mutation", () => {
    const before = testBulletinsStore.getSnapshot()
    testBulletinsStore.add(makeTestBulletin())
    const after = testBulletinsStore.getSnapshot()

    expect(before).not.toBe(after)
  })
})
