// Android uses accessibility ID selector (content-desc attribute)
export function buildSelector(id: string): string {
  return `~${id}` // WebDriverIO accessibility selector
}

// For finding by text content (fallback)
export function buildTextSelector(text: string): string {
  return `android=new UiSelector().text("${text}")`
}

// For finding by partial text
export function buildPartialTextSelector(text: string): string {
  return `android=new UiSelector().textContains("${text}")`
}

// For finding by class name
export function buildClassSelector(className: string): string {
  return `android=new UiSelector().className("${className}")`
}
