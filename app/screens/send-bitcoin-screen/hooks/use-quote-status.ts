import { useCallback, useState } from "react"

type QuoteStatus = {
  /** True only while the tiers on hand were quoted for the inputs currently on screen. */
  hasQuote: boolean
  hasFailed: boolean
  isQuoting: boolean
  discardQuote: () => void
  markQuoted: () => void
  markFailed: () => void
}

/**
 * Tracks which inputs the current quote was made for, so every caller derives its state
 * during render instead of setting a flag from an effect. An effect-set flag lags by a
 * render, which is long enough to pair the previous amount's fee with the amount now on
 * screen; comparing keys is correct on the very render the inputs change. A null key means
 * there is nothing to quote yet, which reads as "no fee" rather than as a quoted zero.
 */
export const useQuoteStatus = (inputsKey: string | null): QuoteStatus => {
  const [quotedKey, setQuotedKey] = useState<string | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)

  const hasQuote = inputsKey !== null && quotedKey === inputsKey
  const hasFailed = inputsKey !== null && failedKey === inputsKey
  const isQuoting = inputsKey !== null && !hasQuote && !hasFailed

  /**
   * Retires whatever is on hand, for the two moments an outcome stops applying: a fresh
   * request going out, and the inputs falling away with nothing left to quote. The second
   * is what stops a user who clears an amount and retypes the same one from landing back
   * on a key the old quote still answers to.
   */
  const discardQuote = useCallback(() => {
    setQuotedKey(null)
    setFailedKey(null)
  }, [])

  /** The outcomes are mutually exclusive, so each one landing retires the other. */
  const markQuoted = useCallback(() => {
    setQuotedKey(inputsKey)
    setFailedKey(null)
  }, [inputsKey])

  const markFailed = useCallback(() => {
    setFailedKey(inputsKey)
    setQuotedKey(null)
  }, [inputsKey])

  return { hasQuote, hasFailed, isQuoting, discardQuote, markQuoted, markFailed }
}
