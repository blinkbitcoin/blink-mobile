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
      // The library hardcodes a white spinner for solid buttons. In dark theme
      // the title on the orange fill is black, so the spinner drifted from the
      // text it stands in for. Track the title's colour instead.
      loadingProps={{ color: colors.backgroundDefault }}
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
    color: colors.backgroundDefault,
  },
  disabledTitleStyle: {
    color: colors.surfaceInteractive,
  },
  buttonStyle: {
    minHeight: 50,
    backgroundColor: colors.accent,
  },
  // Translucent by design: the surface a sticky button sits on is responsible
  // for painting itself, so nothing can show through the button.
  disabledStyle: {
    opacity: 0.5,
    backgroundColor: colors.accent,
  },
}))
