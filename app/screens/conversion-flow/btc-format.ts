export const BTC_SUFFIX = " SAT"

export const formatBtcWithSuffix = (digits: string) => {
  if (!digits) return ""
  return `${digits}${BTC_SUFFIX}`
}

export const findBtcSuffixIndex = (value: string): number => {
  const idx = value.toUpperCase().indexOf(` ${BTC_SUFFIX.trim()}`)
  return idx >= 0 ? idx : value.length
}
