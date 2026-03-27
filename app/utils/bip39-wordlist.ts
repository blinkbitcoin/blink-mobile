import { wordlists } from "bip39"

export const BIP39_WORDLIST_EN: readonly string[] = wordlists.english

type Bip39SuggestionsOptions = {
  minChars?: number
  maxResults?: number
}

export const getBip39Suggestions = (
  prefix: string,
  options?: Bip39SuggestionsOptions,
): string[] => {
  const minChars = options?.minChars ?? 3
  const maxResults = options?.maxResults ?? 10

  if (prefix.length < minChars) return []
  const lower = prefix.toLowerCase()
  return BIP39_WORDLIST_EN.filter((word) => word.startsWith(lower)).slice(0, maxResults)
}
