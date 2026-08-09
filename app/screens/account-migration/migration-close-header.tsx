import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { testProps } from "@app/utils/testProps"

type MigrationCloseHeaderProps = {
  onClose?: () => void
  testID: string
}

/**
 * The flow's top-right close control: the row keeps its fixed height even without an
 * onClose, so gated screens hold the same layout as closable ones.
 */
export const MigrationCloseHeader: React.FC<MigrationCloseHeaderProps> = ({
  onClose,
  testID,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.header}>
      {onClose ? (
        <GaloyIconButton
          name="close"
          size="medium"
          backgroundColor={colors.grey5}
          onPress={onClose}
          {...testProps(testID)}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  header: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
}))
