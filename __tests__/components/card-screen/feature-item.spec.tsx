import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"

import { FeatureItem } from "@app/components/card-screen/feature-item"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../../screens/helper"

jest.mock("@app/components/atomic/galoy-icon", () => {
  const actual = jest.requireActual("@app/components/atomic/galoy-icon")
  const { Text } = jest.requireActual("react-native")
  return {
    ...actual,
    GaloyIcon: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  }
})

describe("FeatureItem", () => {
  it("shows the feature's icon and title", async () => {
    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <FeatureItem feature={{ icon: "coins", title: "At $10M pre-money valuation" }} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByTestId("icon-coins")).toBeTruthy()
    expect(getByText("At $10M pre-money valuation")).toBeTruthy()
  })

  /** `flex: 1` on the title is what lets a long one wrap inside the row instead of
   *  pushing past it; this pins the style, not the layout. */
  it("gives the title the room the icon leaves", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <FeatureItem
          feature={{ icon: "bitcoin", title: "You receive 10,000 units ~0.1% of Blink" }}
        />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(
      StyleSheet.flatten(
        getByText("You receive 10,000 units ~0.1% of Blink").props.style,
      ),
    ).toMatchObject({ flex: 1 })
  })
})
