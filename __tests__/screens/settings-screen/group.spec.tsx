import React from "react"
import { Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { SettingsGroup } from "@app/screens/settings-screen/group"

const RowA: React.FC = () => <Text>Row A</Text>
const RowB: React.FC = () => <Text>Row B</Text>
const NullRow: React.FC = () => null

const renderGroup = (props: Partial<React.ComponentProps<typeof SettingsGroup>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <SettingsGroup name="Group" items={[RowA, RowB]} {...props} />
    </ThemeProvider>,
  )

describe("SettingsGroup", () => {
  it("renders the name and every non-null item", () => {
    const { getByText } = renderGroup()

    expect(getByText("Group")).toBeTruthy()
    expect(getByText("Row A")).toBeTruthy()
    expect(getByText("Row B")).toBeTruthy()
  })

  it("renders nothing when every item resolves to null", () => {
    const { toJSON } = render(
      <ThemeProvider theme={theme}>
        <SettingsGroup name="Group" items={[NullRow]} />
      </ThemeProvider>,
    )

    expect(toJSON()).toBeNull()
  })

  it("keeps items interactive when not disabled", () => {
    const onDisabledPress = jest.fn()

    const { getByText } = renderGroup({ onDisabledPress })

    fireEvent.press(getByText("Row A"))

    expect(onDisabledPress).not.toHaveBeenCalled()
  })

  it("routes every tap to onDisabledPress when disabled", () => {
    const onDisabledPress = jest.fn()

    const { getByLabelText } = renderGroup({ disabled: true, onDisabledPress })

    /** The gated rows leave the accessibility tree; the gate stands in by name. */
    fireEvent.press(getByLabelText("Group"))

    expect(onDisabledPress).toHaveBeenCalledTimes(1)
  })

  it("hides its rows from screen readers while the group is disabled", () => {
    const { queryByText } = renderGroup({ disabled: true, onDisabledPress: jest.fn() })

    expect(queryByText("Row A")).toBeNull()
    expect(queryByText("Row A", { includeHiddenElements: true })).toBeTruthy()
  })
})
