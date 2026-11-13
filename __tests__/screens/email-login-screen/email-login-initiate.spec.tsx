import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { Input } from "@rn-vui/themed"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { EmailLoginInitiateScreen } from "@app/screens/email-login-screen/email-login-initiate"

import { expectFocusFill, flatStyle } from "../../helpers/field-fill"
import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

/** rn-vui types `Input`'s ref as the bare TextInput underneath it, which does not fit a
 *  component type. Only the container style is read here. */
const ThemedInput = Input as unknown as React.ComponentType<{
  inputContainerStyle: unknown
}>

describe("EmailLoginInitiateScreen", () => {
  it("fills the email field, darker while it has focus, and starts focused", async () => {
    render(
      <ContextForScreen>
        <EmailLoginInitiateScreen />
      </ContextForScreen>,
    )
    await flushEffects()
    const field = screen.getByPlaceholderText(
      LL.EmailRegistrationInitiateScreen.placeholder(),
    )

    expectFocusFill({
      startsFocused: true,
      surfaces: () => [
        flatStyle(screen.UNSAFE_getByType(ThemedInput).props.inputContainerStyle),
      ],
      focus: () => fireEvent(field, "focus"),
      blur: () => fireEvent(field, "blur"),
    })
  })
})
