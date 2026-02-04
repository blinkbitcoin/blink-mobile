import React from "react"
import { TouchableOpacity, View } from "react-native"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export const ValueStyle = {
  Bold: "bold",
  Regular: "regular",
} as const

export type ValueStyleType = (typeof ValueStyle)[keyof typeof ValueStyle]

type IconProps =
  | { rightIcon?: IconNamesType; rightIonicon?: never }
  | { rightIcon?: never; rightIonicon?: string }

type InputFieldProps = {
  label: string
  value: string
  onPress?: () => void
  valueStyle?: ValueStyleType
} & IconProps

type StyleProps = {
  valueStyle: ValueStyleType
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  rightIcon,
  rightIonicon,
  onPress,
  valueStyle = ValueStyle.Bold,
}) => {
  const styles = useStyles({ valueStyle })
  const {
    theme: { colors },
  } = useTheme()

  const rightIconElement = rightIonicon ? (
    <Icon name={rightIonicon} type="ionicon" size={20} color={colors.primary} />
  ) : rightIcon ? (
    <GaloyIcon name={rightIcon} size={20} color={colors.primary} />
  ) : null

  const content = (
    <View style={styles.valueContainer}>
      <Text style={styles.value}>{value}</Text>
      {rightIconElement}
    </View>
  )

  const pressableContent = onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  ) : (
    content
  )

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {pressableContent}
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { valueStyle }: StyleProps) => {
  const isBold = valueStyle === ValueStyle.Bold

  return {
    container: {
      gap: 3,
    },
    label: {
      color: colors.black,
      fontSize: 14,
      fontFamily: "Source Sans Pro",
      fontWeight: "400",
      lineHeight: 20,
    },
    valueContainer: {
      backgroundColor: colors.grey5,
      borderRadius: 8,
      minHeight: 50,
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: 5,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
    },
    value: {
      flex: 1,
      color: isBold ? colors.black : colors.grey2,
      fontSize: isBold ? 14 : 16,
      fontFamily: "Source Sans Pro",
      fontWeight: isBold ? "700" : "400",
      lineHeight: isBold ? 20 : 22,
    },
  }
})
