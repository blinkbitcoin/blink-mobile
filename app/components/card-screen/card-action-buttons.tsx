import React from "react"
import { View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { IconNamesType } from "@app/components/atomic/galoy-icon/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"

type CardActionButtonsProps = {
  isFrozen: boolean
  freezeLoading?: boolean
  onDetails: () => void
  onFreeze: () => void
  onSetLimits: () => void
  onStatements: () => void
}

type ActionItem = {
  label: string
  icon: IconNamesType
  onPress: () => void
  isFreezeButton?: boolean
  iconSize?: number
  loading?: boolean
}

export const CardActionButtons: React.FC<CardActionButtonsProps> = ({
  isFrozen,
  freezeLoading,
  onDetails,
  onFreeze,
  onSetLimits,
  onStatements,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const actions: ActionItem[] = [
    {
      label: LL.CardFlow.CardDashboard.Actions.details(),
      icon: "eye",
      onPress: onDetails,
      iconSize: 38,
    },
    {
      label: LL.CardFlow.CardDashboard.Actions.freeze(),
      icon: "snowflake",
      onPress: onFreeze,
      isFreezeButton: true,
      iconSize: 32,
      loading: freezeLoading,
    },
    {
      label: LL.CardFlow.CardDashboard.Actions.setLimits(),
      icon: "speedometer",
      onPress: onSetLimits,
      iconSize: 34,
    },
    {
      label: LL.CardFlow.CardDashboard.Actions.statements(),
      icon: "book-open",
      onPress: onStatements,
      iconSize: 32,
    },
  ]

  return (
    <View style={styles.container}>
      {actions.map((action) => {
        const isActiveFrozen = action.isFreezeButton && isFrozen

        return (
          <View key={action.icon} style={styles.actionButton}>
            <GaloyIconButton
              name={action.icon}
              size={51}
              iconSize={action.iconSize}
              text={action.label}
              onPress={action.onPress}
              color={isActiveFrozen ? colors.error : colors.primary}
              backgroundColor={isActiveFrozen ? colors.error9 : colors.grey4}
              loading={action.loading}
            />
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 12,
    height: 94,
    marginHorizontal: 20,
    marginTop: 15,
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
}))
