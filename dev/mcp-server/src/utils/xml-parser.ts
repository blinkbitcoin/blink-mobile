import { XMLParser } from "fast-xml-parser"

export interface ElementNode {
  tag: string
  id?: string
  text?: string
  bounds?: string
  clickable?: boolean
  enabled?: boolean
  focused?: boolean
  scrollable?: boolean
  children?: ElementNode[]
}

export type FilterType = "all" | "interactive" | "text"

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
})

// Strip Android package prefixes from class names
function simplifyClassName(className: string): string {
  return className
    .replace(/^android\.widget\./, "")
    .replace(/^android\.view\./, "")
    .replace(/^androidx\.[\w.]+\./, "")
}

// Parse bounds string "[x1,y1][x2,y2]" - keep as-is for simplicity
function parseBounds(bounds: string): string {
  return bounds
}

// Check if element passes filter
function passesFilter(node: ElementNode, filter: FilterType): boolean {
  if (filter === "all") return true
  if (filter === "interactive") {
    return !!(node.clickable || node.scrollable || node.focused)
  }
  if (filter === "text") {
    return !!(node.text && node.text.trim().length > 0)
  }
  return true
}

// Extract element info from attributes (works for both formats)
function extractElementInfo(
  attrs: Record<string, unknown>,
  tagName: string,
): ElementNode {
  const node: ElementNode = {
    tag: simplifyClassName((attrs["@_class"] as string) || tagName),
  }

  // Map content-desc to id (more intuitive for testID)
  const contentDesc = attrs["@_content-desc"] as string
  if (contentDesc) {
    node.id = contentDesc
  }

  // Map resource-id as fallback id
  const resourceId = attrs["@_resource-id"] as string
  if (!node.id && resourceId) {
    const parts = resourceId.split("/")
    node.id = parts[parts.length - 1]
  }

  // Text content
  const text = attrs["@_text"] as string
  if (text) {
    node.text = text
  }

  // Bounds
  const bounds = attrs["@_bounds"] as string
  if (bounds) {
    node.bounds = parseBounds(bounds)
  }

  // Boolean attrs
  if (attrs["@_clickable"] === "true") node.clickable = true
  if (attrs["@_enabled"] === "false") node.enabled = false
  if (attrs["@_focused"] === "true") node.focused = true
  if (attrs["@_scrollable"] === "true") node.scrollable = true

  return node
}

// Convert element - handles both Appium format (class-name tags) and UIAutomator format (<node> tags)
function convertElement(
  tagName: string,
  data: Record<string, unknown>,
  filter: FilterType,
  currentDepth: number,
  maxDepth: number,
): ElementNode | null {
  if (currentDepth > maxDepth) return null

  const node = extractElementInfo(data, tagName)

  // Process children (any non-attribute keys)
  const children: ElementNode[] = []
  for (const key of Object.keys(data)) {
    if (key.startsWith("@_")) continue

    const childValue = data[key]
    if (Array.isArray(childValue)) {
      // Multiple children with same tag
      for (const child of childValue) {
        if (typeof child === "object" && child !== null) {
          const childNode = convertElement(
            key,
            child as Record<string, unknown>,
            filter,
            currentDepth + 1,
            maxDepth,
          )
          if (childNode) children.push(childNode)
        }
      }
    } else if (typeof childValue === "object" && childValue !== null) {
      // Single child
      const childNode = convertElement(
        key,
        childValue as Record<string, unknown>,
        filter,
        currentDepth + 1,
        maxDepth,
      )
      if (childNode) children.push(childNode)
    }
  }

  if (children.length > 0) {
    node.children = children
  }

  // Include node if: it passes filter OR has children (children already passed)
  if (filter === "all") return node
  if (passesFilter(node, filter)) return node
  if (children.length > 0) return node

  return null
}

// Collect all testIDs (content-desc values) from tree
export function collectTestIds(node: ElementNode | null): string[] {
  if (!node) return []
  const ids: string[] = []

  function walk(n: ElementNode) {
    if (n.id) ids.push(n.id)
    n.children?.forEach(walk)
  }

  walk(node)
  return [...new Set(ids)].sort()
}

// UI info for display
export interface UiInfo {
  id?: string
  text?: string
  tag: string
}

// Collect UI info (id, text, tag) for all elements
export function collectUiInfo(node: ElementNode | null): UiInfo[] {
  if (!node) return []
  const items: UiInfo[] = []

  function walk(n: ElementNode) {
    if (n.id || n.text) {
      items.push({
        id: n.id,
        text: n.text,
        tag: n.tag,
      })
    }
    n.children?.forEach(walk)
  }

  walk(node)
  return items
}

// Main export: parse Android UI XML to efficient JSON
// Supports both Appium format (class-name tags) and UIAutomator format (<node> tags)
export function parsePageSource(
  xml: string,
  options: { maxDepth?: number; filter?: FilterType } = {},
): ElementNode | null {
  const { maxDepth = 50, filter = "all" } = options

  try {
    const parsed = parser.parse(xml)

    // Find root element (usually hierarchy)
    const rootKey = Object.keys(parsed).find((k) => !k.startsWith("?"))
    if (!rootKey) return null

    const rootElement = (parsed as Record<string, unknown>)[rootKey]
    if (!rootElement || typeof rootElement !== "object") return null

    const rootObj = rootElement as Record<string, unknown>

    // Find first child element (skip attributes)
    const childKey = Object.keys(rootObj).find((k) => !k.startsWith("@_"))
    if (!childKey) return null

    const childValue = rootObj[childKey]
    if (!childValue || typeof childValue !== "object") return null

    return convertElement(
      childKey,
      childValue as Record<string, unknown>,
      filter,
      0,
      maxDepth,
    )
  } catch (error) {
    console.error("Failed to parse page source:", error)
    return null
  }
}
