import React from "react"
import { Pressable } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

import { OptionRow } from "./option-row"

type SelectableOptionRowProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle: string
  value?: string
  valueColor?: string
  isSelected: boolean
  /** Left out for an option shown but not offered. */
  onPress?: () => void
  isDisabled?: boolean
}

export const SelectableOptionRow: React.FC<SelectableOptionRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  isSelected,
  onPress,
  isDisabled = false,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const caretColor = isDisabled ? colors.textDisabled : colors.accent
  /** Left unset when enabled: Pressable adds any `disabled` it gets to the
   *  accessibility state, and an enabled option should announce only its selection. */
  const pressableDisabled = isDisabled ? true : undefined

  return (
    <Pressable
      onPress={onPress}
      disabled={pressableDisabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <OptionRow
        icon={icon}
        iconColor={iconColor}
        title={title}
        subtitle={subtitle}
        value={value}
        valueColor={valueColor}
        highlighted={isSelected}
        isDisabled={isDisabled}
      >
        <GaloyIcon name="caret-right" size={16} color={caretColor} />
      </OptionRow>
    </Pressable>
  )
}
