import React from "react"
import { View, StyleProp, ViewStyle, TextStyle } from "react-native"

import { makeStyles, useTheme, Text, Divider } from "@rn-vui/themed"

import { DisabledFeature } from "@app/components/disabled-feature"
import { testProps } from "@app/utils/testProps"

type SettingsGroupProps = {
  name?: string
  items: React.FC[]
  containerStyle?: StyleProp<ViewStyle>
  dividerStyle?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  disabled?: boolean
  onDisabledPress?: () => void
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  name,
  items,
  containerStyle,
  dividerStyle,
  titleStyle,
  disabled = false,
  onDisabledPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const filteredItems = items.filter((x) => x({}) !== null)

  if (filteredItems.length === 0) return null

  return (
    <View>
      {name && (
        <Text {...testProps(name + "-group")} type="p2" style={titleStyle}>
          {name}
        </Text>
      )}
      <View style={[styles.groupCard, containerStyle]}>
        <DisabledFeature
          disabled={disabled}
          onDisabledPress={onDisabledPress}
          accessibilityLabel={name}
        >
          {filteredItems.map((Element, index) => {
            const hasDividerBelow = index < filteredItems.length - 1
            return (
              <View key={index}>
                <Element />
                {hasDividerBelow && (
                  <Divider color={colors.grey4} style={[styles.divider, dividerStyle]} />
                )}
              </View>
            )
          })}
        </DisabledFeature>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  groupCard: {
    marginTop: 5,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: 14,
  },
}))
