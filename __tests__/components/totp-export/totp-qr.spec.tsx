import React from "react"
import { StyleSheet, View } from "react-native"
import { render, screen } from "@testing-library/react-native"
import QRCode from "react-native-qrcode-svg"
import { ThemeProvider } from "@rn-vui/themed"

import { QrCodeComponent } from "@app/components/totp-export"
import theme from "@app/rne-theme/theme"

const renderCode = (props: Partial<React.ComponentProps<typeof QrCodeComponent>>) =>
  render(
    <ThemeProvider theme={theme}>
      <QrCodeComponent value="otpauth://totp/Blink:someone" {...props} />
    </ThemeProvider>,
  )

// eslint-disable-next-line camelcase
const qrCode = () => screen.UNSAFE_getByType(QRCode)
// eslint-disable-next-line camelcase
const frameStyle = () =>
  StyleSheet.flatten(screen.UNSAFE_getAllByType(View)[0].props.style)

describe("QrCodeComponent", () => {
  it("draws the value at the size it is given", () => {
    renderCode({ size: 148 })

    expect(qrCode().props).toMatchObject({
      value: "otpauth://totp/Blink:someone",
      size: 148,
    })
  })

  it("keeps the size the API key screen draws it at when none is given", () => {
    renderCode({})

    expect(qrCode().props.size).toBe(200)
  })

  it("lets the screen restyle the white frame around the code", () => {
    renderCode({ containerStyle: { padding: 14, borderRadius: 20 } })

    expect(frameStyle()).toMatchObject({
      padding: 14,
      borderRadius: 20,
      backgroundColor: theme.lightColors?._white,
    })
  })
})
