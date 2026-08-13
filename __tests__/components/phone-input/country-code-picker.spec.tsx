import React from "react"
import { TouchableOpacity } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { CountryCodePicker } from "@app/components/phone-input/country-code-picker"

const mockPicker = jest.fn()
const mockFlag = jest.fn()
const mockOnOpen = jest.fn()

/**
 * The library is stubbed on purpose. What broke in production is the props contract with
 * it: every flag prop used to arrive through `Component.defaultProps`, which React 19 no
 * longer applies to function components, so the flags disappeared without an error. These
 * assertions pin the props this component now sends, which is what has to stay true.
 * Rendering the real library instead would prove nothing, because under Jest those dead
 * defaults still resolve and the flag appears either way.
 */
jest.mock("react-native-country-picker-modal", () => {
  const ReactActual = jest.requireActual("react")
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockPicker(props)
      const renderFlagButton = props.renderFlagButton as (args: {
        countryCode?: string
        onOpen: () => void
      }) => React.ReactNode
      return renderFlagButton({
        countryCode: props.countryCode as string | undefined,
        onOpen: mockOnOpen,
      })
    },
    Flag: (props: Record<string, unknown>) => {
      mockFlag(props)
      return ReactActual.createElement("Flag")
    },
    DARK_THEME: { name: "dark" },
    DEFAULT_THEME: { name: "light" },
  }
})

const mockThemeMode = jest.fn(() => "dark")
jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { mode: mockThemeMode() } }),
}))

const renderPicker = (
  overrides: Partial<React.ComponentProps<typeof CountryCodePicker>> = {},
) =>
  render(
    <CountryCodePicker
      countryCode={"SV" as never}
      countryCodes={["SV", "US"] as never}
      onSelect={jest.fn()}
      {...overrides}
    />,
  )

describe("CountryCodePicker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockThemeMode.mockReturnValue("dark")
  })

  it("asks the picker for the flags the library no longer defaults", () => {
    renderPicker()

    const [pickerProps] = mockPicker.mock.calls[0]
    expect(pickerProps.withEmoji).toBe(true)
    expect(pickerProps.withFlag).toBe(true)
  })

  it("asks the flag button for the props it needs to render at all", () => {
    renderPicker()

    const [flagProps] = mockFlag.mock.calls[0]
    expect(flagProps.withFlagButton).toBe(true)
    expect(flagProps.withEmoji).toBe(true)
    expect(flagProps.countryCode).toBe("SV")
    expect(flagProps.flagSize).toBe(24)
  })

  it("shows the calling code of the selected country", () => {
    const { getByText } = renderPicker()

    expect(getByText("+503")).toBeTruthy()
  })

  it("shows the calling code of another country", () => {
    const { getByText } = renderPicker({ countryCode: "US" as never })

    expect(getByText("+1")).toBeTruthy()
  })

  it("renders no button until the picker resolves a country", () => {
    const { queryByText } = renderPicker({ countryCode: undefined })

    expect(queryByText("+503")).toBeNull()
    expect(mockFlag).not.toHaveBeenCalled()
  })

  it("opens the picker when the button is pressed", () => {
    const { getByText } = renderPicker()

    fireEvent.press(getByText("+503"))

    expect(mockOnOpen).toHaveBeenCalledTimes(1)
  })

  it("hands the caller's selection and close handlers to the picker", () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()
    renderPicker({ onSelect, onClose })

    const [pickerProps] = mockPicker.mock.calls[0]
    expect(pickerProps.onSelect).toBe(onSelect)
    expect(pickerProps.onClose).toBe(onClose)
    expect(pickerProps.countryCodes).toEqual(["SV", "US"])
  })

  it("applies the button style the caller supplies", () => {
    const buttonStyle = { backgroundColor: "rebeccapurple" }
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = renderPicker({ buttonStyle })

    expect(UNSAFE_getByType(TouchableOpacity).props.style).toEqual(buttonStyle)
  })

  it("keeps the picker filterable, which is how a country is found at all", () => {
    renderPicker()

    const [pickerProps] = mockPicker.mock.calls[0]
    expect(pickerProps.withFilter).toBe(true)
    expect(pickerProps.withCallingCode).toBe(true)
    expect(pickerProps.withCallingCodeButton).toBe(true)
    expect(pickerProps.filterProps).toEqual({ autoFocus: true })
  })

  it("rebuilds the picker when the supported countries finally arrive", () => {
    const { rerender } = renderPicker({ countryCodes: [] as never })
    const keyWhileEmpty = mockPicker.mock.calls.length

    rerender(
      <CountryCodePicker
        countryCode={"SV" as never}
        countryCodes={["SV", "US"] as never}
        onSelect={jest.fn()}
      />,
    )

    /** A fresh mount is the point: the library reads its country list once, so reusing the
     *  instance would keep offering every country instead of the supported ones. */
    expect(mockPicker.mock.calls.length).toBeGreaterThan(keyWhileEmpty)
    expect(mockPicker.mock.calls.at(-1)?.[0].countryCodes).toEqual(["SV", "US"])
  })

  it("follows the app theme into the picker", () => {
    renderPicker()
    expect(mockPicker.mock.calls[0][0].theme).toEqual({ name: "dark" })

    jest.clearAllMocks()
    mockThemeMode.mockReturnValue("light")
    renderPicker()

    expect(mockPicker.mock.calls[0][0].theme).toEqual({ name: "light" })
  })
})
