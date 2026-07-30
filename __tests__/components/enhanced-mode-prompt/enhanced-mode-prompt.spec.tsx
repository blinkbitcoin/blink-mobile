import React from "react"
import { Pressable, Text } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { AccountMode } from "@app/types/account"

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? ReactNs.createElement(RN.View, null, children) : null)
  return { __esModule: true, default: MockModal }
})

const mockSetActiveAccountMode = jest.fn()
let mockIsAnonMode = true
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    isAnonMode: mockIsAnonMode,
    setActiveAccountMode: mockSetActiveAccountMode,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

import {
  EnhancedModePromptProvider,
  useEnhancedModePrompt,
} from "@app/components/enhanced-mode-prompt"

loadLocale("en")
const LL = i18nObject("en")

const Opener = () => {
  const { promptEnhancedMode } = useEnhancedModePrompt()
  return (
    <Pressable testID="open-prompt" onPress={promptEnhancedMode}>
      <Text>open</Text>
    </Pressable>
  )
}

const renderWithProvider = () =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <EnhancedModePromptProvider>
          <Opener />
        </EnhancedModePromptProvider>
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("EnhancedModePrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = true
  })

  it("stays hidden until a consumer asks for it", () => {
    const { queryByText } = renderWithProvider()

    expect(queryByText(LL.EnhancedModePrompt.title())).toBeNull()
  })

  it("shows the prompt with its copy and both actions when requested", () => {
    const { getByTestId, getByText } = renderWithProvider()

    fireEvent.press(getByTestId("open-prompt"))

    expect(getByText(LL.EnhancedModePrompt.title())).toBeTruthy()
    expect(getByText(LL.EnhancedModePrompt.body())).toBeTruthy()
    expect(getByText(LL.EnhancedModePrompt.switchButton())).toBeTruthy()
    expect(getByText(LL.common.notNow())).toBeTruthy()
  })

  it("dismisses without switching on Not now", () => {
    const { getByTestId, getByText, queryByText } = renderWithProvider()

    fireEvent.press(getByTestId("open-prompt"))
    fireEvent.press(getByText(LL.common.notNow()))

    expect(queryByText(LL.EnhancedModePrompt.title())).toBeNull()
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
  })

  it("switches to Enhanced, closes, and confirms with a success toast", () => {
    const { getByTestId, getByText, queryByText } = renderWithProvider()

    fireEvent.press(getByTestId("open-prompt"))
    fireEvent.press(getByText(LL.EnhancedModePrompt.switchButton()))

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Enhanced)
    expect(queryByText(LL.EnhancedModePrompt.title())).toBeNull()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    )

    const { message } = mockToastShow.mock.calls[0][0]
    expect(message(LL)).toBe(LL.EnhancedModePrompt.switched())
  })

  it("closes without writing or toasting when the active account can no longer switch", () => {
    mockIsAnonMode = false

    const { getByTestId, getByText, queryByText } = renderWithProvider()

    fireEvent.press(getByTestId("open-prompt"))
    fireEvent.press(getByText(LL.EnhancedModePrompt.switchButton()))

    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(queryByText(LL.EnhancedModePrompt.title())).toBeNull()
  })

  it("no-ops when used outside the provider", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TypesafeI18n locale="en">
          <Opener />
        </TypesafeI18n>
      </ThemeProvider>,
    )

    expect(() => fireEvent.press(getByTestId("open-prompt"))).not.toThrow()
  })
})
