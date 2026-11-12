import React from "react"
import { View } from "react-native"
import { render } from "@testing-library/react-native"

import { MapSearchBar } from "@app/components/map-component/map-search-bar"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { search: () => "Search" },
      MapScreen: { filters: () => "Filters" },
    },
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

/** backgroundDefault and textOnAccent share a value in the real palette, so they get
 *  distinct sentinels here to show which one the filter icon picks. */
jest.mock("@rn-vui/themed", () => {
  const colors = {
    backgroundDefault: "backgroundDefault",
    textOnAccent: "textOnAccent",
    textMuted: "textMuted",
    accent: "accent",
    staticBlack: "staticBlack",
  }
  return {
    makeStyles:
      (
        fn: (theme: { colors: typeof colors }, props: unknown) => Record<string, object>,
      ) =>
      (props: unknown) =>
        fn({ colors }, props),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

const renderBar = (isFiltered: boolean) =>
  render(
    <MapSearchBar
      topInset={0}
      onSearchPress={jest.fn()}
      onFilterPress={jest.fn()}
      isFiltered={isFiltered}
    />,
  )

describe("MapSearchBar", () => {
  it("draws the active filter icon in textOnAccent, the role for content on an accent fill", () => {
    const { getByTestId } = renderBar(true)

    expect(getByTestId("galoy-icon-ellipsis").props.color).toBe("textOnAccent")
  })

  it("draws the idle filter icon in accent", () => {
    const { getByTestId } = renderBar(false)

    expect(getByTestId("galoy-icon-ellipsis").props.color).toBe("accent")
  })
})
