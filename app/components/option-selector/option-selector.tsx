import React, { useEffect } from "react"
import { View, TouchableOpacity, StyleProp, ViewStyle } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"
import { radius } from "@app/rne-theme/radius"
import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"

import { IconNamesType } from "../atomic/galoy-icon"
import { OptionIcon } from "./option-icon"

export type Option = {
  label: string
  value: string
  icon?: IconNamesType
  active?: boolean
  recommended?: boolean
}

export type OptionSelectorProps = {
  options: Option[]
  selected?: string
  onSelect: (value: string) => void
  style?: StyleProp<ViewStyle>
  loading?: boolean
}

export const OptionSelector: React.FC<OptionSelectorProps> = ({
  options,
  selected,
  onSelect,
  style,
  loading = false,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  useEffect(() => {
    if (!selected && !loading) {
      const activeOptions = options.filter((o) => o.active !== false)
      const recommended = activeOptions.find((o) => o.recommended)
      if (recommended) {
        onSelect(recommended.value)
        return
      }

      if (activeOptions.length > 0) {
        onSelect(activeOptions[0].value)
      }
    }
  }, [selected, options, onSelect, loading])

  return (
    <View style={[styles.fieldContainer, style]}>
      {options
        .filter((option) => option.active !== false)
        .map((option) => {
          const isSelected = selected === option.value

          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.fieldBackground,
                isSelected && styles.fieldBackgroundSelected,
              ]}
            >
              <View style={styles.contentContainer}>
                <View style={styles.labelWithRecommended}>
                  <Text style={[styles.label, isSelected && styles.labelSelected]}>
                    {option.label}
                  </Text>
                  {option.recommended && (
                    <Text
                      style={[
                        styles.recommended,
                        isSelected && styles.recommendedSelected,
                      ]}
                    >
                      ({LL.common.recommended()})
                    </Text>
                  )}
                </View>

                <OptionIcon icon={option.icon} isSelected={isSelected} />
              </View>
            </TouchableOpacity>
          )
        })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  fieldContainer: {
    flexDirection: "column",
    rowGap: 12,
  },
  fieldBackground: {
    flexDirection: "row",
    alignItems: "center",
    borderStyle: "solid",
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 16,
    borderRadius: radius.default,
    minHeight: 56,
    borderWidth: 1.5,
  },
  fieldBackgroundSelected: {
    backgroundColor: colors.neutral,
  },
  contentContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },
  labelSelected: {
    color: colors.accent,
  },
  iconContainer: {
    marginLeft: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWithRecommended: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  recommended: {
    fontStyle: "italic",
    fontSize: 15,
    fontFamily: fonts.regular,
    marginLeft: 8,
    color: colors.textMuted,
  },

  recommendedSelected: {
    color: colors.accent,
  },
}))
