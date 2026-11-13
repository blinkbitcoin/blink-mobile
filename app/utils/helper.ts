import { Platform } from "react-native"

import { MASK_CHAR } from "@app/config/appinfo"

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length
  let temporaryValue: T
  let randomIndex: number

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1

    // And swap it with the current element.
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }

  return array
}

export const pickRandomIndices = (total: number, count: number): number[] => {
  const all = Array.from({ length: total }, (_, i) => i)
  return shuffle([...all])
    .slice(0, Math.min(count, total))
    .sort((a, b) => a - b)
}

// Shorten a long text by inserting "..." in the middle, keeping the ends visible.
export const ellipsizeMiddle = (
  text: string,
  options: {
    maxLength: number
    maxResultLeft: number
    maxResultRight: number
  } = {
    maxLength: 50,
    maxResultLeft: 13,
    maxResultRight: 8,
  },
) => {
  const { maxLength, maxResultLeft, maxResultRight } = options
  if (text.length <= maxLength) return text

  return text.slice(0, maxResultLeft) + "..." + text.slice(text.length - maxResultRight)
}

export const isIos = Platform.OS === "ios"

export const normalizeString = (value?: string) => (value ?? "").trim().toLowerCase()

export const maskString = (
  value: string,
  options: {
    visibleRight: number
    maskChar?: string
    maskPattern?: RegExp
  },
) => {
  const { visibleRight, maskChar = MASK_CHAR, maskPattern = /./ } = options
  const pattern = new RegExp(
    maskPattern.source,
    maskPattern.flags.includes("g") ? maskPattern.flags : `${maskPattern.flags}g`,
  )
  const totalMatches = (value.match(pattern) || []).length
  let seenMatches = 0

  return value.replace(pattern, (char) => {
    seenMatches += 1
    return seenMatches <= totalMatches - visibleRight ? maskChar : char
  })
}

export const maskDigits = (
  value: string,
  options: {
    visibleRight: number
    maskChar?: string
  },
) => maskString(value, { ...options, maskPattern: /\d/ })

export const formatCardDisplayNumber = (
  cardNumber: string,
  showDetails: boolean,
  { totalDigits = 16, groupSize = 4, visibleDigits = 4 } = {},
): string => {
  const digits = cardNumber.replaceAll(" ", "")
  const padded = digits.padStart(totalDigits, MASK_CHAR)
  const masked = showDetails
    ? padded
    : maskString(padded, { visibleRight: visibleDigits })
  return (masked.match(new RegExp(`.{1,${groupSize}}`, "g")) ?? [masked]).join(" ")
}

/** The most a GraphQL `Int` holds, which is how the API takes an amount in cents. */
const GRAPHQL_INT_MAX = 2_147_483_647

/** Whole dollars and up to two decimals, after a dot or a comma: the decimal pad shows
 *  whichever separator the device's locale uses. */
const DOLLAR_AMOUNT = /^(\d*)(?:[.,](\d{0,2}))?$/

/**
 * Cents for an amount the user typed, or null when the text is not one whole amount. It
 * takes the text only when all of it is the amount, rather than the leading number a
 * `parseFloat` would read out of `100abc` or `100,50`, so nothing is saved that the user
 * did not type.
 */
export const parseDollarsToCents = (dollars: string): number | null => {
  const match = DOLLAR_AMOUNT.exec(dollars.trim())
  if (!match) return null

  const [, whole, fraction = ""] = match
  const hasDigits = whole !== "" || fraction !== ""
  if (!hasDigits) return null

  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"))
  return cents <= GRAPHQL_INT_MAX ? cents : null
}

export const toMajorUnit = (cents: number): number => cents / 100

export const toNumber = (value: bigint | string | number): number => {
  if (typeof value === "number") return value
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 0
  return parsed
}
