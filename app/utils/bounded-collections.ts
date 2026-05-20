export const insertBounded = <K, V>(
  map: Map<K, V>,
  entry: readonly [K, V],
  maxSize: number,
): void => {
  const [key, value] = entry
  map.delete(key)
  map.set(key, value)
  while (map.size > maxSize) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export const addBounded = <T>(set: Set<T>, value: T, maxSize: number): void => {
  set.delete(value)
  set.add(value)
  while (set.size > maxSize) {
    const oldest = set.values().next().value
    if (oldest === undefined) break
    set.delete(oldest)
  }
}
