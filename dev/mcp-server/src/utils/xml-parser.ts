import { XMLParser } from "fast-xml-parser";

export interface ElementNode {
  tag: string;
  id?: string;
  text?: string;
  bounds?: string;
  clickable?: boolean;
  enabled?: boolean;
  focused?: boolean;
  scrollable?: boolean;
  children?: ElementNode[];
}

export type FilterType = "all" | "interactive" | "text";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

// Strip Android package prefixes from class names
function simplifyClassName(className: string): string {
  return className
    .replace(/^android\.widget\./, "")
    .replace(/^android\.view\./, "")
    .replace(/^androidx\.[\w.]+\./, "");
}

// Parse bounds string "[x1,y1][x2,y2]" - keep as-is for simplicity
function parseBounds(bounds: string): string {
  return bounds;
}

// Check if element passes filter
function passesFilter(node: ElementNode, filter: FilterType): boolean {
  if (filter === "all") return true;
  if (filter === "interactive") {
    return !!(node.clickable || node.scrollable || node.focused);
  }
  if (filter === "text") {
    return !!(node.text && node.text.trim().length > 0);
  }
  return true;
}

// Convert XML node to our ElementNode format
function convertNode(
  xmlNode: Record<string, unknown>,
  filter: FilterType,
  currentDepth: number,
  maxDepth: number,
): ElementNode | null {
  if (currentDepth > maxDepth) return null;

  // Get the tag name (first key that's not an attribute)
  const tagName = Object.keys(xmlNode).find((k) => !k.startsWith("@_"));
  if (!tagName) return null;

  const attrs = xmlNode as Record<string, unknown>;

  const node: ElementNode = {
    tag: simplifyClassName(attrs["@_class"] as string || tagName),
  };

  // Map content-desc to id (more intuitive for testID)
  const contentDesc = attrs["@_content-desc"] as string;
  if (contentDesc) {
    node.id = contentDesc;
  }

  // Map resource-id as fallback id
  const resourceId = attrs["@_resource-id"] as string;
  if (!node.id && resourceId) {
    // Extract just the id part after the colon
    const parts = resourceId.split("/");
    node.id = parts[parts.length - 1];
  }

  // Text content
  const text = attrs["@_text"] as string;
  if (text) {
    node.text = text;
  }

  // Bounds
  const bounds = attrs["@_bounds"] as string;
  if (bounds) {
    node.bounds = parseBounds(bounds);
  }

  // Only include boolean attrs when true (reduce token usage)
  if (attrs["@_clickable"] === "true") node.clickable = true;
  if (attrs["@_enabled"] === "false") node.enabled = false;
  if (attrs["@_focused"] === "true") node.focused = true;
  if (attrs["@_scrollable"] === "true") node.scrollable = true;

  // Process children
  const children: ElementNode[] = [];
  for (const key of Object.keys(xmlNode)) {
    if (key.startsWith("@_")) continue;

    const childValue = xmlNode[key];
    if (Array.isArray(childValue)) {
      for (const child of childValue) {
        if (typeof child === "object" && child !== null) {
          const childNode = convertNode(
            child as Record<string, unknown>,
            filter,
            currentDepth + 1,
            maxDepth,
          );
          if (childNode && passesFilter(childNode, filter)) {
            children.push(childNode);
          }
        }
      }
    } else if (typeof childValue === "object" && childValue !== null) {
      const childNode = convertNode(
        childValue as Record<string, unknown>,
        filter,
        currentDepth + 1,
        maxDepth,
      );
      if (childNode && passesFilter(childNode, filter)) {
        children.push(childNode);
      }
    }
  }

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

// Main export: parse Appium XML to efficient JSON
export function parsePageSource(
  xml: string,
  options: { maxDepth?: number; filter?: FilterType } = {},
): ElementNode | null {
  const { maxDepth = 10, filter = "all" } = options;

  try {
    const parsed = parser.parse(xml);

    // Find root element (usually hierarchy or android.widget.FrameLayout)
    const rootKey = Object.keys(parsed).find((k) => !k.startsWith("?"));
    if (!rootKey) return null;

    return convertNode(
      parsed as Record<string, unknown>,
      filter,
      0,
      maxDepth,
    );
  } catch (error) {
    console.error("Failed to parse page source:", error);
    return null;
  }
}
