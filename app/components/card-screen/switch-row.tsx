import React from "react"
import { View } from "react-native"
import { ListItem, makeStyles, Text } from "@rn-vui/themed"

import { Switch } from "@app/components/atomic/switch"
import { fonts } from "@app/rne-theme/fonts"

type SwitchRowProps = {
  title: string
  description?: string
  /** A short tag beside the switch, such as "Coming soon!" on a row that cannot be used yet. */
  badge?: string
  value?: boolean
  onValueChange?: (value: boolean) => void
  disabled?: boolean
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  title,
  description,
  badge,
  value = false,
  onValueChange = () => {},
  disabled = false,
}) => {
  const styles = useStyles()
  const hasBadge = Boolean(badge)

  return (
    <ListItem containerStyle={styles.listItemContainer}>
      <ListItem.Content>
        <ListItem.Title style={styles.listItemTitle}>{title}</ListItem.Title>
        {description && (
          <ListItem.Subtitle style={styles.listItemSubtitle}>
            {description}
          </ListItem.Subtitle>
        )}
      </ListItem.Content>
      {hasBadge && (
        <View style={styles.badge}>
          <Text bold style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      )}
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
      />
    </ListItem>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listItemContainer: {
    backgroundColor: colors.transparent,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 0,
  },
  listItemTitle: {
    color: colors.textOnBackground,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  listItemSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 16,
  },
  badge: {
    backgroundColor: colors.neutral,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.textSecondary,
  },
}))
