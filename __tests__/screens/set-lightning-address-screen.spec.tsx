import React from "react"
import { act, render, fireEvent, waitFor, screen } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { SUCCESS_SCREEN_EXIT_MS } from "@app/components/success-screen"
import { SetLightningAddressScreen } from "@app/screens/lightning-address-screen/set-lightning-address-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { expectFocusFill, renderedBox } from "../helpers/field-fill"
import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
}))

const mockUpdateUsername = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserUpdateUsernameMutation: () => [mockUpdateUsername, { loading: false }],
}))

const mockRoute: RouteProp<RootStackParamList, "setLightningAddress"> = {
  key: "set-address",
  name: "setLightningAddress",
  params: { onboarding: true },
}

describe("SetLightningAddressScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders screen texts", async () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(LL.SetAddressModal.receiveMoney({ bankName: "Blink" })),
      ).toBeTruthy()
      expect(screen.getByText(LL.SetAddressModal.itCannotBeChanged())).toBeTruthy()
      expect(screen.getByText(LL.SetAddressModal.setLightningAddress())).toBeTruthy()
    })
  })

  it("Shows error when lightning address is too short", async () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "ab")
    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()))

    await waitFor(() => {
      expect(screen.getByText(LL.SetAddressModal.Errors.tooShort())).toBeTruthy()
    })
  })

  it("Shows error when lightning address is invalid", async () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "invalid!@#")
    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()))

    await waitFor(() => {
      expect(screen.getByText(LL.SetAddressModal.Errors.invalidCharacter())).toBeTruthy()
    })
  })

  it("Disables button when input is empty", () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    const button = screen.getByText(LL.SetAddressModal.setLightningAddress())
    expect(button).toBeDisabled()
  })

  it("Shows error when lightning address is too long", async () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    const longAddress = "a".repeat(51)
    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), longAddress)
    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()))

    await waitFor(() => {
      expect(screen.getByText(LL.SetAddressModal.Errors.tooLong())).toBeTruthy()
    })
  })

  it("Does not show error when lightning address is valid (no submit)", async () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "validusername")

    await waitFor(() => {
      expect(screen.queryByText(LL.SetAddressModal.Errors.invalidCharacter())).toBeNull()
      expect(screen.queryByText(LL.SetAddressModal.Errors.tooShort())).toBeNull()
      expect(screen.queryByText(LL.SetAddressModal.Errors.tooLong())).toBeNull()
    })
  })

  /** It does not autofocus, so it starts at rest. */
  it("fills the address field, darker while it has focus", () => {
    render(
      <ContextForScreen>
        <SetLightningAddressScreen route={mockRoute} />
      </ContextForScreen>,
    )
    const field = () => screen.getByPlaceholderText("SatoshiNakamoto")

    expectFocusFill({
      startsFocused: false,
      surfaces: () => [renderedBox(field())],
      focus: () => fireEvent(field(), "focus"),
      blur: () => fireEvent(field(), "blur"),
    })
  })

  describe("once the address is set", () => {
    const settingsRoute: RouteProp<RootStackParamList, "setLightningAddress"> = {
      ...mockRoute,
      params: { onboarding: false },
    }

    const setAddress = async (route = settingsRoute) => {
      render(
        <ContextForScreen>
          <SetLightningAddressScreen route={route} />
        </ContextForScreen>,
      )
      fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "satoshi")
      await act(async () => {
        fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()))
      })
    }

    beforeEach(() => {
      jest.useFakeTimers()
      jest.clearAllMocks()
      mockUpdateUsername.mockResolvedValue({
        data: {
          userUpdateUsername: { errors: [], user: { id: "1", username: "satoshi" } },
        },
      })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("shows the success screen with the new address", async () => {
      await setAddress()

      expect(screen.getByText(LL.SetAddressModal.addressSet())).toBeTruthy()
      expect(screen.getByText(/^satoshi@/)).toBeTruthy()
    })

    it("returns to Settings once the success screen has held", async () => {
      await setAddress()

      act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS - 1))
      expect(mockNavigate).not.toHaveBeenCalled()

      act(() => jest.advanceTimersByTime(1))
      expect(mockNavigate).toHaveBeenCalledWith("settings")
    })

    it("moves on to support, with no way back, during onboarding", async () => {
      await setAddress(mockRoute)

      act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS))

      expect(mockReplace).toHaveBeenCalledWith("onboarding", {
        screen: "supportScreen",
        params: { canGoBack: false },
      })
    })
  })
})
