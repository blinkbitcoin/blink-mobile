import React from "react"
import { Alert } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CloseCardModal } from "@app/screens/card-screen/card-settings-screen/close-card-modal"
import { ContextForScreen } from "../../helper"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
  }
})

const mockOnClose = jest.fn()
const mockOnCloseCard = jest.fn()

describe("CloseCardModal", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  const renderModal = (overrides = {}) =>
    render(
      <ContextForScreen>
        <CloseCardModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseCard={mockOnCloseCard}
          loading={false}
          {...overrides}
        />
      </ContextForScreen>,
    )

  describe("rendering", () => {
    it("renders header title", async () => {
      const { getByText } = renderModal()

      await act(async () => {})

      expect(getByText("Close card account")).toBeTruthy()
    })

    it("renders warning text", async () => {
      const { getByText } = renderModal()

      await act(async () => {})

      expect(
        getByText(
          "This action is permanent. Your Visa card will be canceled and cannot be reactivated.",
        ),
      ).toBeTruthy()
    })

    it("renders instruction text", async () => {
      const { getByText } = renderModal()

      await act(async () => {})

      expect(getByText('Please type "close" to confirm')).toBeTruthy()
    })

    it("renders text input with placeholder", async () => {
      const { getByPlaceholderText } = renderModal()

      await act(async () => {})

      expect(getByPlaceholderText("close")).toBeTruthy()
    })

    it("renders confirm and cancel buttons", async () => {
      const { getByText } = renderModal()

      await act(async () => {})

      expect(getByText("Confirm")).toBeTruthy()
      expect(getByText("Cancel")).toBeTruthy()
    })
  })

  describe("text input validation", () => {
    it("enables confirm when user types close", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).toHaveBeenCalledTimes(1)
      alertSpy.mockRestore()
    })

    it("accepts case-insensitive input", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "CLOSE")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).toHaveBeenCalledTimes(1)
      alertSpy.mockRestore()
    })

    it("accepts input with surrounding whitespace", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "  close  ")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).toHaveBeenCalledTimes(1)
      alertSpy.mockRestore()
    })

    it("does not enable confirm for partial input", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "clo")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it("does not enable confirm for empty input", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })
  })

  describe("cancel button", () => {
    it("calls onClose when cancel is pressed", async () => {
      const { getByText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Cancel"))
      })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("resets text input when cancel is pressed", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Cancel"))
      })

      // After cancel, text was reset so confirm should not trigger alert
      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })
  })

  describe("confirm flow", () => {
    it("shows final alert without closing modal first", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(mockOnClose).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledTimes(1)
      alertSpy.mockRestore()
    })

    it("shows final confirmation alert with correct content", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(alertSpy).toHaveBeenCalledWith(
        "Final Confirmation",
        "Are you sure you want to close your card account? This cannot be undone.",
        [{ text: "Cancel" }, { text: "OK", onPress: expect.any(Function) }],
      )
      alertSpy.mockRestore()
    })

    it("calls onCloseCard without closing modal when OK is pressed in alert", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      const okButton = alertSpy.mock.calls[0][2]![1]
      await act(async () => {
        okButton.onPress!()
      })

      expect(mockOnCloseCard).toHaveBeenCalledTimes(1)
      expect(mockOnClose).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it("does not call onCloseCard without pressing OK in alert", async () => {
      jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      expect(mockOnCloseCard).not.toHaveBeenCalled()
    })

    it("keeps modal open after OK is pressed so user can retry on failure", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")
      const { getByText, getByPlaceholderText } = renderModal()

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("close"), "close")
      })

      await act(async () => {
        fireEvent.press(getByText("Confirm"))
      })

      const okButton = alertSpy.mock.calls[0][2]![1]
      await act(async () => {
        okButton.onPress!()
      })

      // Modal stays open — text is preserved so user can retry
      expect(mockOnClose).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })
  })
})
