import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { EditFieldModal } from "@app/components/card-screen/edit-field-modal"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        grey2: "#666666",
        grey4: "#CCCCCC",
        primary: "#F7931A",
        black: "#000000",
      },
    },
  }),
  makeStyles: () => () => ({
    inputContainer: {},
    input: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        save: () => "Save",
        cancel: () => "Cancel",
      },
    },
  }),
}))

jest.mock("@app/components/custom-modal/custom-modal", () => {
  const MockCustomModal = ({
    isVisible,
    headerTitle,
    body,
    primaryButtonTitle,
    primaryButtonOnPress,
    primaryButtonDisabled,
    secondaryButtonTitle,
    secondaryButtonOnPress,
  }: {
    isVisible: boolean
    toggleModal: () => void
    headerTitle: string
    body: React.ReactNode
    primaryButtonTitle: string
    primaryButtonOnPress: () => void
    primaryButtonDisabled: boolean
    secondaryButtonTitle: string
    secondaryButtonOnPress: () => void
  }) => {
    if (!isVisible) return null
    return (
      <View testID="custom-modal">
        <RNText testID="modal-title">{headerTitle}</RNText>
        {body}
        <RNText
          testID="primary-button"
          onPress={primaryButtonDisabled ? undefined : primaryButtonOnPress}
          accessibilityState={{ disabled: primaryButtonDisabled }}
        >
          {primaryButtonTitle}
        </RNText>
        <RNText testID="secondary-button" onPress={secondaryButtonOnPress}>
          {secondaryButtonTitle}
        </RNText>
      </View>
    )
  }
  return MockCustomModal
})

describe("EditFieldModal", () => {
  const mockToggleModal = jest.fn()
  const mockOnSave = jest.fn()

  const defaultProps = {
    isVisible: true,
    toggleModal: mockToggleModal,
    fieldName: "Full name",
    initialValue: "Joe Nakamoto",
    onSave: mockOnSave,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing when visible", () => {
      const { toJSON } = render(<EditFieldModal {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("does not render when not visible", () => {
      const { queryByTestId } = render(
        <EditFieldModal {...defaultProps} isVisible={false} />,
      )

      expect(queryByTestId("custom-modal")).toBeNull()
    })

    it("displays the field name as title", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      expect(getByTestId("modal-title").props.children).toBe("Full name")
    })

    it("displays the initial value in input", () => {
      const { getByDisplayValue } = render(<EditFieldModal {...defaultProps} />)

      expect(getByDisplayValue("Joe Nakamoto")).toBeTruthy()
    })

    it("displays save button", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      expect(getByTestId("primary-button").props.children).toBe("Save")
    })

    it("displays cancel button", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      expect(getByTestId("secondary-button").props.children).toBe("Cancel")
    })
  })

  describe("different field names", () => {
    it("renders with address line 1 field", () => {
      const { getByTestId } = render(
        <EditFieldModal {...defaultProps} fieldName="Address line 1" />,
      )

      expect(getByTestId("modal-title").props.children).toBe("Address line 1")
    })

    it("renders with address line 2 field", () => {
      const { getByTestId } = render(
        <EditFieldModal {...defaultProps} fieldName="Address line 2" />,
      )

      expect(getByTestId("modal-title").props.children).toBe("Address line 2")
    })

    it("renders with city field", () => {
      const { getByTestId } = render(
        <EditFieldModal {...defaultProps} fieldName="City" initialValue="New York" />,
      )

      expect(getByTestId("modal-title").props.children).toBe("City")
    })
  })

  describe("button states", () => {
    it("save button is disabled when value unchanged", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      const saveButton = getByTestId("primary-button")
      expect(saveButton.props.accessibilityState.disabled).toBe(true)
    })

    it("save button is disabled when value is empty", () => {
      const { getByTestId, getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} />,
      )

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "")

      const saveButton = getByTestId("primary-button")
      expect(saveButton.props.accessibilityState.disabled).toBe(true)
    })

    it("save button is disabled when value is only whitespace", () => {
      const { getByTestId, getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} />,
      )

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "   ")

      const saveButton = getByTestId("primary-button")
      expect(saveButton.props.accessibilityState.disabled).toBe(true)
    })

    it("save button is enabled when value changes", () => {
      const { getByTestId, getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} />,
      )

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "Satoshi Nakamoto")

      const saveButton = getByTestId("primary-button")
      expect(saveButton.props.accessibilityState.disabled).toBe(false)
    })
  })

  describe("interactions", () => {
    it("calls toggleModal when cancel is pressed", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      fireEvent.press(getByTestId("secondary-button"))

      expect(mockToggleModal).toHaveBeenCalledTimes(1)
    })

    it("calls onSave with trimmed value when save is pressed", () => {
      const { getByTestId, getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} />,
      )

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "  Satoshi Nakamoto  ")

      fireEvent.press(getByTestId("primary-button"))

      expect(mockOnSave).toHaveBeenCalledWith("Satoshi Nakamoto")
    })

    it("calls toggleModal after save", () => {
      const { getByTestId, getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} />,
      )

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "Satoshi Nakamoto")

      fireEvent.press(getByTestId("primary-button"))

      expect(mockToggleModal).toHaveBeenCalledTimes(1)
    })

    it("does not call onSave when value unchanged", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} />)

      fireEvent.press(getByTestId("primary-button"))

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it("updates input value on text change", () => {
      const { getByDisplayValue } = render(<EditFieldModal {...defaultProps} />)

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "New Value")

      expect(getByDisplayValue("New Value")).toBeTruthy()
    })
  })

  describe("edge cases", () => {
    it("handles empty initial value", () => {
      const { getByTestId } = render(<EditFieldModal {...defaultProps} initialValue="" />)

      expect(getByTestId("custom-modal")).toBeTruthy()
    })

    it("handles long initial value", () => {
      const longValue =
        "This is a very long address line that should still work correctly"
      const { getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} initialValue={longValue} />,
      )

      expect(getByDisplayValue(longValue)).toBeTruthy()
    })

    it("handles special characters in value", () => {
      const { getByDisplayValue } = render(
        <EditFieldModal {...defaultProps} initialValue="José García-López" />,
      )

      expect(getByDisplayValue("José García-López")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates field name when prop changes", () => {
      const { getByTestId, rerender } = render(<EditFieldModal {...defaultProps} />)

      expect(getByTestId("modal-title").props.children).toBe("Full name")

      rerender(<EditFieldModal {...defaultProps} fieldName="Address line 1" />)

      expect(getByTestId("modal-title").props.children).toBe("Address line 1")
    })

    it("resets value when modal becomes visible", () => {
      const { getByDisplayValue, rerender } = render(<EditFieldModal {...defaultProps} />)

      const input = getByDisplayValue("Joe Nakamoto")
      fireEvent.changeText(input, "Changed Value")

      rerender(<EditFieldModal {...defaultProps} isVisible={false} />)

      rerender(<EditFieldModal {...defaultProps} isVisible={true} />)

      expect(getByDisplayValue("Joe Nakamoto")).toBeTruthy()
    })
  })
})
