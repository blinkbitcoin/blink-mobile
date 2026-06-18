import React from "react"
import { Text as RNText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { DropdownComponent } from "@app/components/card-screen/dropdown"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#3B82F6",
        grey1: "#999999",
        grey3: "#CCCCCC",
        grey4: "#E0E0E0",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    fieldBackground: {},
    contentContainer: {},
    descriptionText: {},
    placeholderText: {},
    iconContainer: {},
    disabled: {},
    modal: {},
    optionContainer: {},
    selectedOption: {},
    optionContent: {},
    optionDescription: {},
  }),
}))

jest.mock("react-native-vector-icons/Ionicons", () => {
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    default: ({ name }: { name: string; size: number; color: string }) => (
      <MockView testID={`icon-${name}`} />
    ),
  }
})

function MockModal({
  children,
  isVisible,
  onModalHide,
}: {
  children: React.ReactNode
  isVisible: boolean
  onModalHide?: () => void
}) {
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native")
  React.useEffect(() => {
    if (!isVisible && onModalHide) onModalHide()
  }, [isVisible, onModalHide])
  return isVisible ? <MockView testID="modal">{children}</MockView> : null
}

jest.mock("react-native-modal", () => ({
  __esModule: true,
  default: MockModal,
}))

describe("DropdownComponent", () => {
  const mockOnValueChange = jest.fn()

  const options = [
    { value: "us", label: "United States" },
    { value: "ca", label: "Canada" },
    { value: "mx", label: "Mexico" },
  ]

  const optionsWithDescriptions = [
    { value: "standard", label: "Standard", description: "5-7 business days" },
    { value: "express", label: "Express", description: "2-3 business days" },
  ]

  const defaultProps = {
    options,
    testID: "dropdown",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<DropdownComponent {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays placeholder when no selectedValue", () => {
      const { getByText } = render(
        <DropdownComponent {...defaultProps} placeholder="Select a country" />,
      )

      expect(getByText("Select a country")).toBeTruthy()
    })

    it("displays selected option label", () => {
      const { getByText } = render(
        <DropdownComponent {...defaultProps} selectedValue="ca" />,
      )

      expect(getByText("Canada")).toBeTruthy()
    })
  })

  describe("modal interaction", () => {
    it("opens modal on press and shows options", () => {
      const { getByTestId, getByText } = render(
        <DropdownComponent {...defaultProps} placeholder="Select a country" />,
      )

      fireEvent.press(getByTestId("dropdown"))

      expect(getByTestId("modal")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
      expect(getByText("Canada")).toBeTruthy()
      expect(getByText("Mexico")).toBeTruthy()
    })

    it("calls onValueChange when option selected", () => {
      const { getByTestId, getByText } = render(
        <DropdownComponent
          {...defaultProps}
          placeholder="Select a country"
          onValueChange={mockOnValueChange}
        />,
      )

      fireEvent.press(getByTestId("dropdown"))
      fireEvent.press(getByText("Canada"))

      expect(mockOnValueChange).toHaveBeenCalledWith("ca")
    })
  })

  describe("disabled state", () => {
    it("disables interaction when disabled", () => {
      const { getByTestId, queryByTestId } = render(
        <DropdownComponent
          {...defaultProps}
          disabled={true}
          onValueChange={mockOnValueChange}
        />,
      )

      fireEvent.press(getByTestId("dropdown"))

      expect(queryByTestId("modal")).toBeNull()
    })

    it("disables interaction when loading", () => {
      const { getByTestId, queryByTestId } = render(
        <DropdownComponent
          {...defaultProps}
          loading={true}
          onValueChange={mockOnValueChange}
        />,
      )

      fireEvent.press(getByTestId("dropdown"))

      expect(queryByTestId("modal")).toBeNull()
    })
  })

  describe("option descriptions", () => {
    it("shows option descriptions when provided", () => {
      const { getByTestId, getByText } = render(
        <DropdownComponent
          options={optionsWithDescriptions}
          testID="dropdown"
          placeholder="Select shipping"
        />,
      )

      fireEvent.press(getByTestId("dropdown"))

      expect(getByText("Standard")).toBeTruthy()
      expect(getByText("5-7 business days")).toBeTruthy()
      expect(getByText("Express")).toBeTruthy()
      expect(getByText("2-3 business days")).toBeTruthy()
    })
  })
})
