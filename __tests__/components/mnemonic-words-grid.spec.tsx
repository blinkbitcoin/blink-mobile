import React from "react"

import { render } from "@testing-library/react-native"

import { MnemonicWordsGrid } from "@app/components/mnemonic-words-grid"

import { ContextForScreen } from "../screens/helper"

describe("MnemonicWordsGrid", () => {
  const twelveWords = [
    "youth",
    "indicate",
    "void",
    "nation",
    "bundle",
    "execute",
    "festival",
    "omit",
    "shift",
    "exhaust",
    "hello",
    "satoshi",
  ]

  it("renders every word it receives", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MnemonicWordsGrid words={twelveWords} />
      </ContextForScreen>,
    )

    twelveWords.forEach((word) => {
      expect(getByText(word)).toBeTruthy()
    })
  })

  it("numbers words 1-N starting at 1 by default", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MnemonicWordsGrid words={twelveWords} />
      </ContextForScreen>,
    )

    expect(getByText("1. ")).toBeTruthy()
    expect(getByText("12. ")).toBeTruthy()
  })

  it("respects startIndex offset for numbering", () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <MnemonicWordsGrid words={["alpha", "beta"]} startIndex={6} />
      </ContextForScreen>,
    )

    expect(getByText("7. ")).toBeTruthy()
    expect(getByText("8. ")).toBeTruthy()
    expect(queryByText("1. ")).toBeNull()
  })

  it("handles odd word counts without crashing", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MnemonicWordsGrid words={["one", "two", "three"]} />
      </ContextForScreen>,
    )

    expect(getByText("one")).toBeTruthy()
    expect(getByText("two")).toBeTruthy()
    expect(getByText("three")).toBeTruthy()
  })

  it("renders nothing meaningful for an empty list", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <MnemonicWordsGrid words={[]} />
      </ContextForScreen>,
    )

    expect(queryByText("1. ")).toBeNull()
  })
})
