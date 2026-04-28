import React from "react"

import { MockedProvider } from "@apollo/client/testing"

import { StoryScreen } from "../../../.storybook/views"
import { QrCodeComponent } from "./totp-qr"

export default {
  title: "Totp QR",
  decorators: [
    (Story) => (
      <MockedProvider>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
}

export const Default = () => (
  <QrCodeComponent value={"otpauth://totp/YOUR_IDENTIFICATION?secret=YOUR_SECRET"} />
)
