import React, { FC, PropsWithChildren } from "react"

import { testProps } from "@app/utils/testProps"
import { TouchableHighlight } from "@app/utils/touchable-wrapper"
import { Button, ButtonProps, makeStyles, useTheme } from "@rn-vui/themed"

export const GaloyPrimaryButton: FC<PropsWithChildren<ButtonProps>> = (props) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Button
      {...(typeof props.title === "string" ? testProps(props.title) : {})}
      activeOpacity={0.85}
      TouchableComponent={TouchableHighlight}
      // The library hardcodes a white spinner for solid buttons, which vanishes
      // on the grey disabled surface (and on the light title colour in dark
      // theme). Track whichever colour the title is wearing instead.
      loadingProps={{ color: props.disabled ? colors.grey1 : colors.white }}
      buttonStyle={styles.buttonStyle}
      titleStyle={styles.titleStyle}
      disabledStyle={styles.disabledStyle}
      disabledTitleStyle={styles.disabledTitleStyle}
      {...props}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  titleStyle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.white,
  },
  // grey1 rather than a lighter grey: on the grey4 surface the muted greys land
  // around 2.4:1, under the 3:1 floor WCAG AA sets even for large bold text.
  disabledTitleStyle: {
    color: colors.grey1,
  },
  buttonStyle: {
    minHeight: 50,
    backgroundColor: colors.primary,
  },
  // Opaque rather than a translucent primary: `opacity` blends the button with
  // whatever sits behind it, so content could show through a disabled CTA. The
  // outline keeps the button's shape readable on surfaces close to grey4 —
  // modals paint grey5, which is barely a shade away from the fill.
  disabledStyle: {
    backgroundColor: colors.grey4,
    borderWidth: 1,
    borderColor: colors.grey3,
  },
}))
