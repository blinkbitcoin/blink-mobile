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
  onPress: () => void
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
}) => {
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      onPress={onPress}
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
      >
        <GaloyIcon name="caret-right" size={16} color={colors.primary} />
      </OptionRow>
    </Pressable>
  )
}
