import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { EmailLoginInitiateScreen } from "@app/screens/email-login-screen/email-login-initiate"

import { expectFocusFill, renderedBox } from "../../helpers/field-fill"
import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

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
      surfaces: () => [renderedBox(field)],
      focus: () => fireEvent(field, "focus"),
      blur: () => fireEvent(field, "blur"),
    })
  })
})
