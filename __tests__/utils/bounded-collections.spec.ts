import { addBounded, insertBounded } from "@app/utils/bounded-collections"

describe("insertBounded", () => {
  it("inserts a new entry under the cap", () => {
    const map = new Map<string, number>()
    insertBounded(map, ["a", 1], 3)
    expect(map.get("a")).toBe(1)
    expect(map.size).toBe(1)
  })

  it("updates an existing entry without growing past the cap", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ])
    insertBounded(map, ["a", 10], 3)
    expect(map.get("a")).toBe(10)
    expect(map.size).toBe(2)
  })

  it("moves the updated entry to the back of insertion order (LRU)", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ])
    insertBounded(map, ["a", 10], 3)
    expect([...map.keys()]).toEqual(["b", "c", "a"])
  })

  it("evicts the oldest entry when inserting past the cap", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ])
    insertBounded(map, ["d", 4], 3)
    expect([...map.keys()]).toEqual(["b", "c", "d"])
    expect(map.has("a")).toBe(false)
  })

  it("can evict multiple entries if the map starts above the cap", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 4],
      ["e", 5],
    ])
    insertBounded(map, ["f", 6], 3)
    expect([...map.keys()]).toEqual(["d", "e", "f"])
    expect(map.size).toBe(3)
  })

  it("is a no-op on size when called with maxSize 0 (drops the just-inserted entry)", () => {
    const map = new Map<string, number>()
    insertBounded(map, ["a", 1], 0)
    expect(map.size).toBe(0)
  })
})

describe("addBounded", () => {
  it("adds a value under the cap", () => {
    const set = new Set<string>()
    addBounded(set, "a", 3)
    expect(set.has("a")).toBe(true)
    expect(set.size).toBe(1)
  })

  it("does not grow past the cap when re-adding an existing value", () => {
    const set = new Set<string>(["a", "b"])
    addBounded(set, "a", 3)
    expect(set.size).toBe(2)
  })

  it("moves the re-added value to the back of insertion order", () => {
    const set = new Set<string>(["a", "b", "c"])
    addBounded(set, "a", 3)
    expect([...set]).toEqual(["b", "c", "a"])
  })

  it("evicts the oldest entry when adding past the cap", () => {
    const set = new Set<string>(["a", "b", "c"])
    addBounded(set, "d", 3)
    expect([...set]).toEqual(["b", "c", "d"])
    expect(set.has("a")).toBe(false)
  })

  it("can evict multiple entries if the set starts above the cap", () => {
    const set = new Set<string>(["a", "b", "c", "d", "e"])
    addBounded(set, "f", 3)
    expect([...set]).toEqual(["d", "e", "f"])
    expect(set.size).toBe(3)
  })
})
