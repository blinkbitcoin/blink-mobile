import React, { FunctionComponent, PropsWithChildren } from "react"

import { testProps } from "@app/utils/testProps"
import { TouchableHighlight } from "@app/utils/touchable-wrapper"
import { Button, ButtonProps, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../galoy-icon"

declare module "@rn-vui/themed" {
  interface ButtonProps {
    underlayColor?: string
  }
}

type GaloySecondaryButtonProps = PropsWithChildren<ButtonProps> & {
  iconName?: IconNamesType
  grey?: boolean
}

export const GaloySecondaryButton: FunctionComponent<GaloySecondaryButtonProps> = (
  props,
) => {
  const { iconName, grey, ...remainingProps } = props
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles(props)

  const icon = iconName ? (
    <GaloyIcon
      name={iconName}
      size={18}
      color={grey ? colors.grey3 : colors.primary}
      style={styles.iconStyle}
    />
  ) : null

  return (
    <Button
      {...(typeof props.title === "string" ? testProps(props.title) : {})}
      {...remainingProps}
      underlayColor={colors.transparent}
      activeOpacity={0.7}
      {...(icon ? { icon } : {})}
      TouchableComponent={TouchableHighlight}
      buttonStyle={styles.buttonStyle}
      disabledStyle={styles.disabledStyle}
      titleStyle={[styles.buttonTitleStyle, props.titleStyle]}
      disabledTitleStyle={styles.disabledTitleStyle}
      loadingProps={{
        color: colors.primary,
      }}
    />
  )
}

const useStyles = makeStyles(({ colors }, props: GaloySecondaryButtonProps) => ({
  disabledStyle: {
    opacity: 0.35,
    backgroundColor: colors.transparent,
  },
  buttonStyle: {
    backgroundColor: colors.transparent,
  },
  buttonTitleStyle: {
    color: props.grey ? colors.grey3 : colors.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  disabledTitleStyle: {
    color: props.grey ? colors.grey3 : colors.primary,
  },
  iconStyle: {
    marginRight: props.iconPosition === "right" ? 0 : 10,
    marginLeft: props.iconPosition === "left" ? 0 : 10,
  },
}))
