import React from "react"
import { Text } from "react-native"

import {
  headerLeftNoGlass,
  headerRightNoGlass,
  noHeaderRight,
} from "@app/components/header-no-glass"

/* The no-glass contract: every helper must emit BOTH the plain render (Android
 * falls back to headerLeft/headerRight) and the `unstable_header*Items` custom
 * item with `hidesSharedBackground: true` (the only way to opt out of the iOS 26
 * Liquid Glass capsule). If either half disappears, one platform regresses. */

describe("headerRightNoGlass", () => {
  const element = <Text>right</Text>
  const render = () => element
  const options = headerRightNoGlass(render)

  it("keeps the plain headerRight render for Android", () => {
    expect(options.headerRight).toBe(render)
  })

  it("emits a single custom item that opts out of the shared glass background", () => {
    expect(options.unstable_headerRightItems?.({ canGoBack: false })).toEqual([
      { type: "custom", element, hidesSharedBackground: true },
    ])
  })
})

describe("headerLeftNoGlass", () => {
  const element = <Text>left</Text>
  const render = () => element
  const options = headerLeftNoGlass(render)

  it("keeps the plain headerLeft render for Android", () => {
    expect(options.headerLeft).toBe(render)
  })

  it("emits a single custom item that opts out of the shared glass background", () => {
    expect(options.unstable_headerLeftItems?.({ canGoBack: false })).toEqual([
      { type: "custom", element, hidesSharedBackground: true },
    ])
  })
})

describe("noHeaderRight", () => {
  it("explicitly clears both keys headerRightNoGlass writes", () => {
    // The keys must be present (set to undefined), not merely absent — spreading
    // into navigation.setOptions only clears options whose keys exist.
    expect(Object.keys(noHeaderRight)).toEqual([
      "headerRight",
      "unstable_headerRightItems",
    ])
    expect(noHeaderRight.headerRight).toBeUndefined()
    expect(noHeaderRight.unstable_headerRightItems).toBeUndefined()
  })
})
