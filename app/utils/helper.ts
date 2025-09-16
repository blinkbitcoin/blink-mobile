import { Platform } from "react-native"

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

// Shorten a long text by inserting "..." in the middle, keeping the ends visible.
export const ellipsizeMiddle = (
  text: string,
  options: {
    maxLength: number
    maxResultLeft: number
    maxResultRight: number
  },
) => {
  const { maxLength, maxResultLeft, maxResultRight } = options
  if (typeof text !== "string") return ""
  if (text.length <= maxLength) return text

  if (typeof maxResultLeft === "number" && typeof maxResultRight === "number") {
    return text.slice(0, maxResultLeft) + "..." + text.slice(text.length - maxResultRight)
  }

  const half = Math.floor((maxLength - 3) / 2)
  return text.slice(0, half) + "..." + text.slice(text.length - half)
}

export const isIos = Platform.OS === "ios"
