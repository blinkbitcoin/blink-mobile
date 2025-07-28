import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { SetLightningAddressScreen } from "@app/screens/lightning-address-screen/set-lightning-address-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "./helper"

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
})
