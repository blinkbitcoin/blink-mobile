export const isCompatibleLink = (input: string): boolean => {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    return false
  }

  return (
    url.protocol === "http:" ||
    url.protocol === "https:" ||
    url.protocol === "bitcoin:" ||
    url.protocol === "lightning:"
  )
}
