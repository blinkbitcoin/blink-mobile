import { IconNamesType, icons } from "@app/components/atomic/galoy-icon"
import { Icon } from "@app/graphql/generated"

const isMappedIconName = (name: string): name is IconNamesType => name in icons

/**
 * The backend icon enum and the app icon map are maintained separately, so a
 * value the app ships no asset for would reach `GaloyIcon`, miss both of its
 * maps and render an empty slot. Returning undefined for unmapped names keeps
 * the default ionicon as the single fallback for unknown icons.
 */
export const toGaloyIconName = (icon?: Icon | null): IconNamesType | undefined => {
  if (!icon) {
    return undefined
  }

  const derivedName = icon.toLowerCase().replace(/_/g, "-")
  return isMappedIconName(derivedName) ? derivedName : undefined
}

export const timeAgo = (pastDate: number): string => {
  const now = new Date()
  const past = new Date(pastDate * 1000)
  const diff = Number(now) - Number(past)

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return `a few seconds ago`
  } else if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  }
  return `${days} day${days > 1 ? "s" : ""} ago`
}
