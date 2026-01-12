import { TextInput } from "react-native"
import { renderHook, act } from "@testing-library/react-hooks"

import { useConversionOverlayFocus } from "@app/screens/conversion-flow/hooks/use-conversion-overlay-focus"
import { ConvertInputType } from "@app/components/transfer-amount-input"
import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"

describe("useConversionOverlayFocus", () => {
  const mockSetLockFormattingInputId = jest.fn()
  const mockSetIsTyping = jest.fn()
  const mockSetFocusedInputValues = jest.fn()
  const mockRenderValue = jest.fn()
  const mockFromInputFocus = jest.fn()
  const mockFromInputSetNativeProps = jest.fn()
  const mockToInputFocus = jest.fn()
  const mockToInputSetNativeProps = jest.fn()

  const fromInputRef = {
    current: {
      focus: mockFromInputFocus,
      setNativeProps: mockFromInputSetNativeProps,
    } as unknown as TextInput,
  }

  const toInputRef = {
    current: {
      focus: mockToInputFocus,
      setNativeProps: mockToInputSetNativeProps,
    } as unknown as TextInput,
  }

  const defaultInputValues = {
    formattedAmount: "",
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "SAT" },
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: DisplayCurrency,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: DisplayCurrency, currencyCode: "USD" },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockRenderValue.mockReturnValue("100")
  })

  it("does not focus input when uiLocked is true", () => {
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: true,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.FROM)
    })

    expect(mockFromInputFocus).not.toHaveBeenCalled()
    expect(mockSetIsTyping).not.toHaveBeenCalled()
  })

  it("focuses FROM input when handleInputPress is called with FROM", () => {
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.FROM)
    })

    expect(mockFromInputFocus).toHaveBeenCalled()
    expect(mockSetIsTyping).toHaveBeenCalledWith(false)
    expect(mockSetFocusedInputValues).toHaveBeenCalled()
  })

  it("focuses TO input when handleInputPress is called with TO", () => {
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.TO)
    })

    expect(mockToInputFocus).toHaveBeenCalled()
    expect(mockSetIsTyping).toHaveBeenCalledWith(false)
    expect(mockSetFocusedInputValues).toHaveBeenCalled()
  })

  it("clears lockFormattingInputId when different from pressed input", () => {
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: ConvertInputType.TO,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.FROM)
    })

    expect(mockSetLockFormattingInputId).toHaveBeenCalledWith(null)
  })

  it("does not clear lockFormattingInputId when same as pressed input", () => {
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: ConvertInputType.FROM,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.FROM)
    })

    expect(mockSetLockFormattingInputId).not.toHaveBeenCalled()
  })

  it("sets cursor position after BTC suffix for FROM input", () => {
    mockRenderValue.mockReturnValue("100 SAT")
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.handleInputPress(ConvertInputType.FROM)
    })

    expect(mockFromInputSetNativeProps).toHaveBeenCalledWith({
      selection: { start: 3, end: 3 },
    })
  })

  it("focusPhysically focuses FROM input correctly", () => {
    mockRenderValue.mockReturnValue("100")
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.focusPhysically(ConvertInputType.FROM)
    })

    expect(mockFromInputFocus).toHaveBeenCalled()
    expect(mockFromInputSetNativeProps).toHaveBeenCalledWith({
      selection: { start: 3, end: 3 },
    })
  })

  it("focusPhysically focuses TO input correctly", () => {
    mockRenderValue.mockReturnValue("$100")
    const { result } = renderHook(() =>
      useConversionOverlayFocus({
        uiLocked: false,
        lockFormattingInputId: null,
        setLockFormattingInputId: mockSetLockFormattingInputId,
        setIsTyping: mockSetIsTyping,
        inputFormattedValues: defaultInputValues,
        inputValues: defaultInputValues,
        renderValue: mockRenderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues: mockSetFocusedInputValues,
      }),
    )

    act(() => {
      result.current.focusPhysically(ConvertInputType.TO)
    })

    expect(mockToInputFocus).toHaveBeenCalled()
    expect(mockToInputSetNativeProps).toHaveBeenCalledWith({
      selection: { start: 4, end: 4 },
    })
  })
})
