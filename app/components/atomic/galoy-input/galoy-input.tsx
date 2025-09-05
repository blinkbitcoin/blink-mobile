import * as React from "react"
import { TextInput } from "react-native"

import { Input, InputProps, makeStyles } from "@rn-vui/themed"

const useStyles = makeStyles(({ colors }) => ({
  inputContainerFocused: {
    borderBottomColor: colors.grey3,
  },
}))

type GaloyInputProps = {
  initIsFocused?: boolean
}

const GaloyInputFunction = (
  props: InputProps & GaloyInputProps,
  ref: React.Ref<TextInput & React.PropsWithChildren<InputProps>>,
) => {
  const styles = useStyles()

  const [isFocused, setIsFocused] = React.useState(props.initIsFocused ?? false)

  return (
    <Input
      {...props}
      inputContainerStyle={[
        props.inputContainerStyle,
        isFocused ? styles.inputContainerFocused : null,
      ]}
      onFocus={(e) => {
        setIsFocused(true)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        setIsFocused(false)
        props.onBlur?.(e)
      }}
      ref={ref}
      autoComplete="off"
    />
  )
}

const GaloyInput = React.forwardRef(GaloyInputFunction)

export { GaloyInput }
