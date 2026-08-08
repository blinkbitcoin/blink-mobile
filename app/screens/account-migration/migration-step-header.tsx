import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { testProps } from "@app/utils/testProps"

type MigrationStepHeaderProps = {
  onBack?: () => void
  onClose?: () => void
  testIdPrefix: string
}

/**
 * The flow's top controls, each optional: back on the left, close on the right. Both
 * sides are always laid out, so a screen with only one control keeps it on its own side
 * and the row holds the same height as a screen with neither.
 */
export const MigrationStepHeader: React.FC<MigrationStepHeaderProps> = ({
  onBack,
  onClose,
  testIdPrefix,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.header}>
      <View>
        {onBack ? (
          <GaloyIconButton
            name="arrow-left"
            size="medium"
            iconOnly
            color={colors.black}
            onPress={onBack}
            {...testProps(`${testIdPrefix}-back`)}
          />
        ) : null}
      </View>
      <View>
        {onClose ? (
          <GaloyIconButton
            name="close"
            size="medium"
            backgroundColor={colors.grey5}
            onPress={onClose}
            {...testProps(`${testIdPrefix}-close`)}
          />
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  header: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
}))
