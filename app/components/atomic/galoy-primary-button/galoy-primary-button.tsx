import React, { FC, PropsWithChildren } from "react"

import { testProps } from "@app/utils/testProps"
import { TouchableHighlight } from "@app/utils/touchable-wrapper"
import { Button, ButtonProps, makeStyles } from "@rn-vui/themed"

export const GaloyPrimaryButton: FC<PropsWithChildren<ButtonProps>> = (props) => {
  const styles = useStyles()

  return (
    <Button
      {...(typeof props.title === "string" ? testProps(props.title) : {})}
      activeOpacity={0.85}
      TouchableComponent={TouchableHighlight}
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
  disabledTitleStyle: {
    color: colors.grey5,
  },
  buttonStyle: {
    minHeight: 50,
    backgroundColor: colors.primary,
  },
  disabledStyle: {
    opacity: 0.5,
    backgroundColor: colors.primary,
  },
}))
