import React from "react"
import { StyleSheet, View } from "react-native"
import { render } from "@testing-library/react-native"

import { PasswordInput } from "@app/components/password-input"
import { WarningCard } from "@app/components/warning-card"
import { IconTextButton } from "@app/components/icon-text-button"
import { OptionCardGroup } from "@app/components/option-card-group"
import { SuggestionBar } from "@app/components/suggestion-bar"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"

import { ContextForScreen } from "../screens/helper"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

/**
 * One shared component per role (card, input, button, option card, chip, error box),
 * rendered through the real theme. Each draws its corners at `radius.default` and none is
 * left on the deprecated 8 or the old 10 (blink-wip#2106).
 */

const cornerRadii = (element: React.ReactElement): number[] => {
  const { UNSAFE_root: root } = render(<ContextForScreen>{element}</ContextForScreen>)
  return root
    .findAll((node) => typeof node.type === "string")
    .map((node) => StyleSheet.flatten(node.props.style)?.borderRadius)
    .filter((value): value is number => typeof value === "number")
}

const probe = StyleSheet.create({ oldCorner: { borderRadius: 8 } })

const surfaces: [string, React.ReactElement][] = [
  ["warning card", <WarningCard key="card" title="Heads up" />],
  [
    "password input",
    <PasswordInput key="input" label="Password" value="" onChangeText={jest.fn()} />,
  ],
  [
    "icon-text button",
    <IconTextButton key="button" icon="map" label="View on map" onPress={jest.fn()} />,
  ],
  [
    "option card",
    <OptionCardGroup
      key="option"
      options={[{ key: "a", icon: "cloud", title: "Cloud", description: "Backup" }]}
      selectedKey={null}
      onSelect={jest.fn()}
    />,
  ],
  [
    "suggestion chip",
    <SuggestionBar key="chip" suggestions={["abandon"]} onSelect={jest.fn()} />,
  ],
  ["error box", <GaloyErrorBox key="error" errorMessage="Something went wrong" />],
]

describe("default radius on shared surfaces", () => {
  surfaces.forEach(([name, element]) => {
    it(`draws the ${name} at 12`, () => {
      const radii = cornerRadii(element)

      expect(radii).toContain(12)
      expect(radii).not.toContain(8)
      expect(radii).not.toContain(10)
    })
  })

  it("reads a host view's corner, so a missing radius doesn't pass", () => {
    expect(cornerRadii(<View style={probe.oldCorner} />)).toEqual([8])
  })
})
