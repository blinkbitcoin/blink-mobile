import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { RouteProp } from "@react-navigation/native"

import { PhoneCodeChannelType } from "@app/graphql/generated"
import type { PhoneValidationStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen/phone-login-initiate-type"
import { PhoneLoginValidationScreen } from "@app/screens/phone-auth-screen/phone-login-validation"

import { expectFocusFill, renderedBox } from "../../helpers/field-fill"
import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

/** The friendly channel names alone: the module behind them loads app-check. */
jest.mock("@app/screens/phone-auth-screen/request-phone-code-login", () => ({
  PhoneCodeChannelToFriendlyName: {
    SMS: "SMS",
    WHATSAPP: "WhatsApp",
    TELEGRAM: "Telegram",
  },
}))

const route: RouteProp<PhoneValidationStackParamList, "phoneLoginValidate"> = {
  key: "phoneLoginValidate",
  name: "phoneLoginValidate",
  params: {
    phone: "+50760000000",
    channel: PhoneCodeChannelType.Sms,
    type: PhoneLoginInitiateType.Login,
  },
}

describe("PhoneLoginValidationScreen", () => {
  it("fills the code field, darker while it has focus, and starts focused", async () => {
    render(
      <ContextForScreen>
        <PhoneLoginValidationScreen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()
    const field = screen.getByPlaceholderText("000000")

    expectFocusFill({
      startsFocused: true,
      surfaces: () => [renderedBox(field)],
      focus: () => fireEvent(field, "focus"),
      blur: () => fireEvent(field, "blur"),
    })
  })
})
