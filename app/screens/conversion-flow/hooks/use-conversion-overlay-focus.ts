import { useCallback } from "react"
import { TextInput } from "react-native"

import { ConvertInputType } from "@app/components/transfer-amount-input"

import { IInputValues, InputField } from "../use-convert-money-details"

type Params = {
  uiLocked: boolean
  lockFormattingInputId: InputField["id"] | null
  setLockFormattingInputId: (id: InputField["id"] | null) => void
  setIsTyping: (v: boolean) => void
  inputFormattedValues: IInputValues | null
  inputValues: IInputValues
  renderValue: (id: InputField["id"]) => string | undefined
  fromInputRef: React.RefObject<TextInput>
  toInputRef: React.RefObject<TextInput>
  setFocusedInputValues: React.Dispatch<React.SetStateAction<InputField | null>>
}

const findSatIndex = (value: string): number => {
  const idx = value.toUpperCase().indexOf(" SAT")
  return idx >= 0 ? idx : value.length
}

export const useConversionOverlayFocus = ({
  uiLocked,
  lockFormattingInputId,
  setLockFormattingInputId,
  setIsTyping,
  inputFormattedValues,
  inputValues,
  renderValue,
  fromInputRef,
  toInputRef,
  setFocusedInputValues,
}: Params) => {
  const handleInputPress = useCallback(
    (id: InputField["id"]) => {
      if (uiLocked) return

      if (lockFormattingInputId && lockFormattingInputId !== id) {
        setLockFormattingInputId(null)
      }
      setIsTyping(false)

      const ref = id === ConvertInputType.FROM ? fromInputRef : toInputRef
      const value = renderValue(id) ?? ""
      const pos = findSatIndex(value)
      const inputToFocus =
        id === ConvertInputType.FROM
          ? inputFormattedValues?.fromInput ?? inputValues.fromInput
          : inputFormattedValues?.toInput ?? inputValues.toInput

      setFocusedInputValues({ ...inputToFocus })
      ref.current?.focus()
      ref.current?.setNativeProps({ selection: { start: pos, end: pos } })
    },
    [
      uiLocked,
      lockFormattingInputId,
      setLockFormattingInputId,
      setIsTyping,
      inputFormattedValues,
      inputValues,
      renderValue,
      fromInputRef,
      toInputRef,
      setFocusedInputValues,
    ],
  )

  const focusPhysically = useCallback(
    (id: InputField["id"]) => {
      const ref = id === ConvertInputType.FROM ? fromInputRef : toInputRef
      const value = renderValue(id) ?? ""
      const pos = findSatIndex(value)
      ref.current?.focus()
      ref.current?.setNativeProps({ selection: { start: pos, end: pos } })
    },
    [renderValue, fromInputRef, toInputRef],
  )

  return { handleInputPress, focusPhysically }
}
