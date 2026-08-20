import React from "react"
import { StyleProp, StyleSheet, TextInput, ViewStyle } from "react-native"
import { Input, ThemeProvider, createTheme } from "@rn-vui/themed"
import { act, fireEvent, render } from "@testing-library/react-native"

import { PhoneInput } from "@app/components/phone-input/phone-input"

const mockCountryCodePicker = jest.fn()
jest.mock("@app/components/phone-input/country-code-picker", () => ({
  CountryCodePicker: (props: Record<string, unknown>) => {
    mockCountryCodePicker(props)
    return null
  },
}))

const mockDeviceLocation = jest.fn()
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockDeviceLocation(),
}))

const mockSupportedCountries = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSupportedCountriesQuery: () => mockSupportedCountries(),
}))

/** Only the theme is needed: every data source PhoneInput reads is mocked above, and the
 *  full screen context would spin up providers that log act warnings for no gain here. */
const renderInput = (node: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme({})}>{node}</ThemeProvider>)

/** What `disabledInput` amounts to in the stylesheet, which is all a caller can observe. */
const DIMMED_STYLE = { opacity: 0.6 }

/** The query needs a plain component type, and rn-vui types `Input`'s ref as the bare
 *  TextInput underneath it, which does not fit one. Only the style prop is read here. */
const ThemedInput = Input as unknown as React.ComponentType<{
  containerStyle: StyleProp<ViewStyle>
  inputContainerStyle: StyleProp<ViewStyle>
}>

describe("PhoneInput", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeviceLocation.mockReturnValue({ countryCode: "SV", loading: false })
    mockSupportedCountries.mockReturnValue({
      data: { globals: { supportedCountries: [{ id: "SV" }, { id: "US" }] } },
    })
  })

  it("delegates the country button to the shared picker", () => {
    renderInput(<PhoneInput value="" onChangeText={jest.fn()} />)

    expect(mockCountryCodePicker).toHaveBeenCalled()
    const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
    expect(props.countryCode).toBe("SV")
    expect(props.countryCodes).toEqual(["SV", "US"])
  })

  it("hands the picker an empty country list until the query answers", () => {
    mockSupportedCountries.mockReturnValue({ data: undefined })

    renderInput(<PhoneInput value="" onChangeText={jest.fn()} />)

    const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
    expect(props.countryCodes).toEqual([])
  })

  it("shows the skeleton instead of the picker while the location resolves", () => {
    mockDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })

    renderInput(<PhoneInput value="" onChangeText={jest.fn()} />)

    expect(mockCountryCodePicker).not.toHaveBeenCalled()
  })

  it("leaves the row's free space to the phone field, not to the country button", () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = renderInput(
      <PhoneInput value="" onChangeText={jest.fn()} />,
    )

    /** The phone auth screens each grew their own copy of this button and ended up with
     *  two halves fighting over the row, which left the number unreadably narrow. This
     *  copy never had the defect, so the test guards it forward rather than proving a
     *  fix: exactly one of the two may grow, and here it is the field. */
    const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
    const button = StyleSheet.flatten(props.buttonStyle as StyleProp<ViewStyle>)
    expect(button.flex).toBeUndefined()
    expect(button.flexGrow).toBeUndefined()
    expect(button.width).toBeUndefined()
    expect(button.flexBasis).toBeUndefined()

    const field = StyleSheet.flatten(UNSAFE_getByType(ThemedInput).props.containerStyle)
    expect(field.flex).toBe(1)
  })

  it("dims both halves of the field when the caller disables it", () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = renderInput(
      <PhoneInput value="" isDisabled={true} onChangeText={jest.fn()} />,
    )

    const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
    expect(props.buttonStyle).toContainEqual(DIMMED_STYLE)
    expect(UNSAFE_getByType(ThemedInput).props.inputContainerStyle).toContainEqual(
      DIMMED_STYLE,
    )
  })

  it("reports the country and the formatted number to its caller", () => {
    const onChangeInfo = jest.fn()

    renderInput(
      <PhoneInput
        value="78662557"
        onChangeText={jest.fn()}
        onChangeInfo={onChangeInfo}
      />,
    )

    expect(onChangeInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: "SV",
        countryCallingCode: "503",
        rawPhoneNumber: "78662557",
      }),
    )
  })

  it("reports nothing while there is no country to report", () => {
    mockDeviceLocation.mockReturnValue({ countryCode: undefined, loading: false })
    const onChangeInfo = jest.fn()

    renderInput(
      <PhoneInput value="" onChangeText={jest.fn()} onChangeInfo={onChangeInfo} />,
    )

    expect(onChangeInfo).toHaveBeenCalledWith(null)
  })

  it("adopts the country the user picks", () => {
    const onChangeInfo = jest.fn()
    renderInput(
      <PhoneInput value="" onChangeText={jest.fn()} onChangeInfo={onChangeInfo} />,
    )

    const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
    act(() => {
      ;(props.onSelect as (country: { cca2: string }) => void)({ cca2: "US" })
    })

    expect(onChangeInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryCode: "US", countryCallingCode: "1" }),
    )
  })

  const expectRefocus = (handler: "onClose" | "onSelect", delay: number) => {
    jest.useFakeTimers()
    const focus = jest.spyOn(TextInput.prototype, "focus")
    try {
      renderInput(<PhoneInput value="" onChangeText={jest.fn()} />)
      const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
      focus.mockClear()

      act(() => {
        ;(props[handler] as (arg?: unknown) => void)({ cca2: "US" })
        jest.advanceTimersByTime(delay)
      })

      expect(focus).toHaveBeenCalledTimes(1)
    } finally {
      focus.mockRestore()
      jest.useRealTimers()
    }
  }

  it("returns focus to the field after the picker closes", () => {
    expectRefocus("onClose", 300)
  })

  it("returns focus to the field after a country is chosen", () => {
    expectRefocus("onSelect", 100)
  })

  it("adopts the country of a number typed with its international prefix", () => {
    const onChangeText = jest.fn()
    const onChangeInfo = jest.fn()
    const { getByTestId } = renderInput(
      <PhoneInput value="" onChangeText={onChangeText} onChangeInfo={onChangeInfo} />,
    )

    fireEvent.changeText(getByTestId("telephoneNumber"), "+14155552671")

    expect(onChangeText).toHaveBeenCalledWith("+14155552671")
    expect(onChangeInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryCode: "US" }),
    )
  })

  it("adopts the country of a number it is handed already written", () => {
    const onChangeInfo = jest.fn()

    renderInput(
      <PhoneInput
        value="+14155552671"
        onChangeText={jest.fn()}
        onChangeInfo={onChangeInfo}
      />,
    )

    /** The number outranks the location here: a US number reached the field while the
     *  device says SV, and the country has to follow the number. */
    expect(onChangeInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryCode: "US", countryCallingCode: "1" }),
    )
  })

  it("leaves a handed-in number's country alone when the caller pins the country", () => {
    const onChangeInfo = jest.fn()

    renderInput(
      <PhoneInput
        value="+14155552671"
        keepCountryCode={true}
        onChangeText={jest.fn()}
        onChangeInfo={onChangeInfo}
      />,
    )

    expect(onChangeInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryCode: "SV" }),
    )
  })

  it("keeps the chosen country when the caller pins it", () => {
    const onChangeInfo = jest.fn()
    const { getByTestId } = renderInput(
      <PhoneInput
        value=""
        keepCountryCode={true}
        onChangeText={jest.fn()}
        onChangeInfo={onChangeInfo}
      />,
    )

    fireEvent.changeText(getByTestId("telephoneNumber"), "+14155552671")

    expect(onChangeInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryCode: "SV" }),
    )
  })
})
