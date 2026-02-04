import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { SelectionScreen } from "@app/screens/settings-screen/selection-screen"
import { ContextForScreen } from "../helper"

const mockOnSelect = jest.fn()

const mockRouteParams = {
  title: "State",
  options: [
    { value: "NY", label: "New York" },
    { value: "CA", label: "California" },
    { value: "TX", label: "Texas" },
  ],
  selectedValue: "NY",
  onSelect: mockOnSelect,
}

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useRoute: () => ({
      params: mockRouteParams,
    }),
  }
})

jest.mock("@app/components/menu-select", () => ({
  MenuSelect: ({
    value,
    onChange,
    children,
  }: {
    value: string
    onChange: (value: string) => Promise<void>
    children: React.ReactNode
  }) => (
    <View testID="menu-select" accessibilityHint={value}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const childProps = child.props as { value: string; children: React.ReactNode }
          return (
            <RNText
              testID={`menu-item-${childProps.value}`}
              onPress={() => onChange(childProps.value)}
            >
              {childProps.children}
            </RNText>
          )
        }
        return child
      })}
    </View>
  ),
  MenuSelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <View testID={`menu-select-item-${value}`}>
      <RNText>{children}</RNText>
    </View>
  ),
}))

describe("SelectionScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockRouteParams.selectedValue = "NY"
    mockRouteParams.options = [
      { value: "NY", label: "New York" },
      { value: "CA", label: "California" },
      { value: "TX", label: "Texas" },
    ]
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays all options", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("New York")).toBeTruthy()
      expect(getByText("California")).toBeTruthy()
      expect(getByText("Texas")).toBeTruthy()
    })

    it("displays menu select component", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("menu-select")).toBeTruthy()
    })

    it("has correct initial selected value", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const menuSelect = getByTestId("menu-select")
      expect(menuSelect.props.accessibilityHint).toBe("NY")
    })
  })

  describe("state options", () => {
    it("renders state selection options", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("New York")).toBeTruthy()
      expect(getByText("California")).toBeTruthy()
      expect(getByText("Texas")).toBeTruthy()
    })

    it("renders with different initial selection", async () => {
      mockRouteParams.selectedValue = "CA"

      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const menuSelect = getByTestId("menu-select")
      expect(menuSelect.props.accessibilityHint).toBe("CA")
    })
  })

  describe("country options", () => {
    beforeEach(() => {
      mockRouteParams.title = "Country"
      mockRouteParams.options = [
        { value: "USA", label: "United States" },
        { value: "CAN", label: "Canada" },
        { value: "MEX", label: "Mexico" },
      ]
      mockRouteParams.selectedValue = "USA"
    })

    it("renders country selection options", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("United States")).toBeTruthy()
      expect(getByText("Canada")).toBeTruthy()
      expect(getByText("Mexico")).toBeTruthy()
    })

    it("has correct initial country selection", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const menuSelect = getByTestId("menu-select")
      expect(menuSelect.props.accessibilityHint).toBe("USA")
    })
  })

  describe("interactions", () => {
    it("calls onSelect when option is selected", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-CA"))
      })

      expect(mockOnSelect).toHaveBeenCalledWith("CA")
    })

    it("calls onSelect with correct value for different option", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-TX"))
      })

      expect(mockOnSelect).toHaveBeenCalledWith("TX")
    })

    it("updates current value after selection", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-CA"))
      })

      const menuSelect = getByTestId("menu-select")
      expect(menuSelect.props.accessibilityHint).toBe("CA")
    })
  })

  describe("edge cases", () => {
    it("handles single option", async () => {
      mockRouteParams.options = [{ value: "NY", label: "New York" }]

      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("New York")).toBeTruthy()
    })

    it("handles many options", async () => {
      mockRouteParams.options = [
        { value: "AL", label: "Alabama" },
        { value: "AK", label: "Alaska" },
        { value: "AZ", label: "Arizona" },
        { value: "AR", label: "Arkansas" },
        { value: "CA", label: "California" },
        { value: "CO", label: "Colorado" },
        { value: "CT", label: "Connecticut" },
        { value: "DE", label: "Delaware" },
        { value: "FL", label: "Florida" },
        { value: "GA", label: "Georgia" },
      ]

      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Alabama")).toBeTruthy()
      expect(getByText("Georgia")).toBeTruthy()
    })

    it("handles option with long label", async () => {
      mockRouteParams.options = [
        {
          value: "LONG",
          label: "This is a very long state name that should still render",
        },
      ]
      mockRouteParams.selectedValue = "LONG"

      const { getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText("This is a very long state name that should still render"),
      ).toBeTruthy()
    })
  })

  describe("complete user flow", () => {
    it("user can select a state", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("New York")).toBeTruthy()
      expect(getByText("California")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-CA"))
      })

      expect(mockOnSelect).toHaveBeenCalledWith("CA")
    })

    it("user can change selection multiple times", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <SelectionScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-CA"))
      })

      await act(async () => {
        fireEvent.press(getByTestId("menu-item-TX"))
      })

      expect(mockOnSelect).toHaveBeenCalledTimes(2)
      expect(mockOnSelect).toHaveBeenNthCalledWith(1, "CA")
      expect(mockOnSelect).toHaveBeenNthCalledWith(2, "TX")
    })
  })
})
