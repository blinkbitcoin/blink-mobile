import { describe, it, expect } from "vitest"
import {
  buildSelector,
  buildTextSelector,
  buildPartialTextSelector,
  buildClassSelector,
} from "../../utils/selectors.js"

describe("buildSelector", () => {
  it("builds accessibility ID selector with ~ prefix", () => {
    expect(buildSelector("loginButton")).toBe("~loginButton")
  })

  it("handles IDs with special characters", () => {
    expect(buildSelector("my-button_1")).toBe("~my-button_1")
  })

  it("handles empty string", () => {
    expect(buildSelector("")).toBe("~")
  })
})

describe("buildTextSelector", () => {
  it("builds UiSelector text selector", () => {
    const result = buildTextSelector("Log In")
    expect(result).toBe('android=new UiSelector().text("Log In")')
  })

  it("handles text with special characters", () => {
    const result = buildTextSelector("$100.00")
    expect(result).toBe('android=new UiSelector().text("$100.00")')
  })
})

describe("buildPartialTextSelector", () => {
  it("builds UiSelector textContains selector", () => {
    const result = buildPartialTextSelector("Welcome")
    expect(result).toBe('android=new UiSelector().textContains("Welcome")')
  })
})

describe("buildClassSelector", () => {
  it("builds UiSelector className selector", () => {
    const result = buildClassSelector("android.widget.Button")
    expect(result).toBe('android=new UiSelector().className("android.widget.Button")')
  })
})
