import { describe, it, expect } from "vitest";
import {
  parsePageSource,
  collectTestIds,
  collectUiInfo,
  type ElementNode,
} from "../../utils/xml-parser.js";

const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" content-desc="" text="" bounds="[0,0][1080,2340]" clickable="false" enabled="true">
    <android.widget.Button class="android.widget.Button" content-desc="loginButton" text="Log In" bounds="[100,200][300,250]" clickable="true" enabled="true" />
    <android.widget.TextView class="android.widget.TextView" content-desc="" text="Welcome to Blink" bounds="[100,50][980,100]" clickable="false" enabled="true" />
    <android.widget.EditText class="android.widget.EditText" content-desc="phoneInput" text="" bounds="[100,120][980,170]" clickable="true" enabled="true" focused="true" />
  </android.widget.FrameLayout>
</hierarchy>`;

const NESTED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" content-desc="" bounds="[0,0][1080,2340]" clickable="false" enabled="true">
    <android.view.ViewGroup class="android.view.ViewGroup" content-desc="homeScreen" bounds="[0,0][1080,2340]" clickable="false" enabled="true">
      <android.widget.ScrollView class="android.widget.ScrollView" content-desc="" bounds="[0,100][1080,2000]" clickable="false" enabled="true" scrollable="true">
        <android.widget.TextView class="android.widget.TextView" content-desc="balanceText" text="$100.00" bounds="[100,150][980,200]" clickable="false" enabled="true" />
        <android.widget.Button class="android.widget.Button" content-desc="sendButton" text="Send" bounds="[100,250][500,300]" clickable="true" enabled="true" />
        <android.widget.Button class="android.widget.Button" content-desc="receiveButton" text="Receive" bounds="[550,250][980,300]" clickable="true" enabled="true" />
      </android.widget.ScrollView>
    </android.view.ViewGroup>
  </android.widget.FrameLayout>
</hierarchy>`;

const RESOURCE_ID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.galoyapp:id/root" content-desc="" bounds="[0,0][1080,2340]" clickable="false" enabled="true">
    <android.widget.Button class="android.widget.Button" resource-id="com.galoyapp:id/submit_btn" content-desc="" text="Submit" bounds="[100,200][300,250]" clickable="true" enabled="true" />
  </android.widget.FrameLayout>
</hierarchy>`;

describe("parsePageSource", () => {
  it("parses simple XML and returns element tree", () => {
    const result = parsePageSource(SIMPLE_XML);
    expect(result).not.toBeNull();
    expect(result!.tag).toBe("FrameLayout");
  });

  it("extracts content-desc as id", () => {
    const result = parsePageSource(SIMPLE_XML);
    const children = result!.children!;
    const button = children.find((c) => c.id === "loginButton");
    expect(button).toBeDefined();
    expect(button!.text).toBe("Log In");
    expect(button!.clickable).toBe(true);
  });

  it("extracts text content", () => {
    const result = parsePageSource(SIMPLE_XML);
    const children = result!.children!;
    const textView = children.find((c) => c.text === "Welcome to Blink");
    expect(textView).toBeDefined();
    expect(textView!.tag).toBe("TextView");
  });

  it("detects focused elements", () => {
    const result = parsePageSource(SIMPLE_XML);
    const children = result!.children!;
    const input = children.find((c) => c.id === "phoneInput");
    expect(input).toBeDefined();
    expect(input!.focused).toBe(true);
  });

  it("parses nested hierarchy", () => {
    const result = parsePageSource(NESTED_XML);
    expect(result).not.toBeNull();
    // Should have ViewGroup child
    const viewGroup = result!.children!.find((c) => c.id === "homeScreen");
    expect(viewGroup).toBeDefined();
  });

  it("detects scrollable elements", () => {
    const result = parsePageSource(NESTED_XML);
    const viewGroup = result!.children!.find((c) => c.id === "homeScreen");
    const scrollView = viewGroup!.children!.find((c) => c.scrollable);
    expect(scrollView).toBeDefined();
    expect(scrollView!.tag).toBe("ScrollView");
  });

  it("falls back to resource-id when no content-desc", () => {
    const result = parsePageSource(RESOURCE_ID_XML);
    expect(result!.id).toBe("root");
    const button = result!.children!.find((c) => c.id === "submit_btn");
    expect(button).toBeDefined();
    expect(button!.text).toBe("Submit");
  });

  it("respects maxDepth option", () => {
    const result = parsePageSource(NESTED_XML, { maxDepth: 1 });
    expect(result).not.toBeNull();
    // At depth 1, should have first-level children but not deeper
    const viewGroup = result!.children?.find((c) => c.id === "homeScreen");
    expect(viewGroup).toBeDefined();
    // Children of viewGroup should be cut off at depth 1
    expect(viewGroup!.children).toBeUndefined();
  });

  it("filters interactive elements", () => {
    const result = parsePageSource(SIMPLE_XML, { filter: "interactive" });
    expect(result).not.toBeNull();

    function collectAll(node: ElementNode): ElementNode[] {
      const nodes = [node];
      node.children?.forEach((c) => nodes.push(...collectAll(c)));
      return nodes;
    }

    const allNodes = collectAll(result!);
    // Leaf interactive nodes should be clickable, scrollable, or focused
    const leaves = allNodes.filter((n) => !n.children || n.children.length === 0);
    for (const leaf of leaves) {
      expect(leaf.clickable || leaf.scrollable || leaf.focused).toBe(true);
    }
  });

  it("filters text elements", () => {
    const result = parsePageSource(SIMPLE_XML, { filter: "text" });
    expect(result).not.toBeNull();

    function collectLeaves(node: ElementNode): ElementNode[] {
      if (!node.children || node.children.length === 0) return [node];
      const leaves: ElementNode[] = [];
      node.children.forEach((c) => leaves.push(...collectLeaves(c)));
      return leaves;
    }

    const leaves = collectLeaves(result!);
    for (const leaf of leaves) {
      expect(leaf.text).toBeDefined();
      expect(leaf.text!.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns null for invalid XML", () => {
    const result = parsePageSource("not xml at all");
    expect(result).toBeNull();
  });

  it("returns null for empty hierarchy", () => {
    const result = parsePageSource(`<?xml version="1.0"?><hierarchy></hierarchy>`);
    expect(result).toBeNull();
  });

  it("strips android package prefixes from class names", () => {
    const result = parsePageSource(SIMPLE_XML);
    expect(result!.tag).toBe("FrameLayout"); // Not android.widget.FrameLayout
    const button = result!.children!.find((c) => c.id === "loginButton");
    expect(button!.tag).toBe("Button");
  });
});

describe("collectTestIds", () => {
  it("collects all content-desc IDs from tree", () => {
    const tree = parsePageSource(NESTED_XML);
    const ids = collectTestIds(tree);
    expect(ids).toContain("homeScreen");
    expect(ids).toContain("balanceText");
    expect(ids).toContain("sendButton");
    expect(ids).toContain("receiveButton");
  });

  it("returns unique sorted IDs", () => {
    const tree = parsePageSource(SIMPLE_XML);
    const ids = collectTestIds(tree);
    expect(ids).toEqual([...new Set(ids)].sort());
  });

  it("returns empty array for null tree", () => {
    expect(collectTestIds(null)).toEqual([]);
  });
});

describe("collectUiInfo", () => {
  it("collects elements with id or text", () => {
    const tree = parsePageSource(SIMPLE_XML);
    const info = collectUiInfo(tree);
    expect(info.length).toBeGreaterThan(0);

    const loginBtn = info.find((i) => i.id === "loginButton");
    expect(loginBtn).toBeDefined();
    expect(loginBtn!.text).toBe("Log In");
    expect(loginBtn!.tag).toBe("Button");
  });

  it("returns empty array for null tree", () => {
    expect(collectUiInfo(null)).toEqual([]);
  });

  it("includes text-only elements without IDs", () => {
    const tree = parsePageSource(SIMPLE_XML);
    const info = collectUiInfo(tree);
    const welcome = info.find((i) => i.text === "Welcome to Blink");
    expect(welcome).toBeDefined();
  });
});
