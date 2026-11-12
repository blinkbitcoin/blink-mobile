import React, { FC, PropsWithChildren, Ref } from "react"
import { View } from "react-native"

import { testProps } from "@app/utils/testProps"
import { TouchableHighlight } from "@app/utils/touchable-wrapper"
import { Button, ButtonProps, makeStyles, useTheme } from "@rn-vui/themed"
import { fonts } from "@app/rne-theme/fonts"

type GaloyPrimaryButtonProps = PropsWithChildren<ButtonProps> & {
  /** The button's native pressable, e.g. to move screen reader focus to it. */
  pressableRef?: Ref<View>
}

export const GaloyPrimaryButton: FC<GaloyPrimaryButtonProps> = ({
  pressableRef,
  ...props
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  // RNE hands its unknown props to the touchable, which passes this one on as its ref.
  const touchableProps = pressableRef ? { hostRef: pressableRef } : {}

  return (
    <Button
      {...(typeof props.title === "string" ? testProps(props.title) : {})}
      activeOpacity={0.85}
      TouchableComponent={TouchableHighlight}
      // The library hardcodes a white spinner for solid buttons. In dark theme
      // the title on the orange fill is black, so the spinner drifted from the
      // text it stands in for. Track the title's colour instead.
      loadingProps={{ color: colors.white }}
      buttonStyle={styles.buttonStyle}
      titleStyle={styles.titleStyle}
      disabledStyle={styles.disabledStyle}
      disabledTitleStyle={styles.disabledTitleStyle}
      {...touchableProps}
      {...props}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  titleStyle: {
    flexGrow: 1,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.white,
  },
  disabledTitleStyle: {
    color: colors.grey5,
  },
  buttonStyle: {
    minHeight: 50,
    backgroundColor: colors.primary,
  },
  // Translucent by design: the surface a sticky button sits on is responsible
  // for painting itself, so nothing can show through the button.
  disabledStyle: {
    opacity: 0.5,
    backgroundColor: colors.primary,
  },
}))
