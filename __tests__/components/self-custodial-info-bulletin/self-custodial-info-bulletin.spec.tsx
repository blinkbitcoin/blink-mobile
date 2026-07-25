import React from "react"
import { Linking } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"

import { SelfCustodialInfoBulletin } from "@app/components/self-custodial-info-bulletin"
import { reportError } from "@app/utils/error-logging"

const BLOG_URL = "https://www.blink.sv/blog/non-custodial-accounts-in-blink-wallet"

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#007",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "dismiss-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "cta-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      NonCustodialInfoBulletin: {
        title: () => "This is a non-custodial account",
        body: () => "To learn more read our blog post",
        cta: () => "Read",
      },
    },
  }),
}))

describe("SelfCustodialInfoBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  })

  it("renders title and body", () => {
    const { getByText } = render(<SelfCustodialInfoBulletin onDismiss={jest.fn()} />)

    expect(getByText("This is a non-custodial account")).toBeTruthy()
    expect(getByText("To learn more read our blog post")).toBeTruthy()
  })

  it("renders the read CTA", () => {
    const { getByText } = render(<SelfCustodialInfoBulletin onDismiss={jest.fn()} />)

    expect(getByText("Read")).toBeTruthy()
  })

  it("calls onDismiss when the close button is pressed", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    fireEvent.press(getByTestId("dismiss-button"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("opens the blog post and dismisses when the CTA is pressed", async () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByTestId("cta-button"))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(Linking.openURL).toHaveBeenCalledWith(BLOG_URL)
  })

  it("still dismisses and reports the error when opening the blog post fails", async () => {
    ;(Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error("no handler"))
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByTestId("cta-button"))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      "Open self-custodial info bulletin link",
      expect.any(Error),
    )
  })
})
