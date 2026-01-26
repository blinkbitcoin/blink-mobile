const measure = async ({ text = "", fontSize = 14 } = {}) => {
  const safeText = typeof text === "string" ? text : ""
  const safeFontSize = typeof fontSize === "number" ? fontSize : 14
  return {
    width: safeText.length * safeFontSize * 0.5,
    height: safeFontSize,
    lineCount: 1,
  }
}

const flatHeights = async ({ text = [], fontSize = 14 } = {}) => {
  const safeFontSize = typeof fontSize === "number" ? fontSize : 14
  return Array.isArray(text) ? text.map(() => safeFontSize) : []
}

const fontNamesForFamilyName = async () => []

module.exports = {
  measure,
  flatHeights,
  fontNamesForFamilyName,
}
