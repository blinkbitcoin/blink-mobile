import * as React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { Key } from "@app/components/amount-input-screen/number-pad-reducer"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { CurrencyKeyboard } from "@app/components/currency-keyboard"

export type AmountInputScreenUIProps = {
  errorMessage?: string
  onKeyPress: (key: Key) => void
  disabledKeys?: ReadonlySet<Key>
}

export const AmountInputScreenUI: React.FC<AmountInputScreenUIProps> = ({
  errorMessage,
  onKeyPress,
  disabledKeys,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const hasError = Boolean(errorMessage)

  return (
    <View style={styles.container}>
      <View style={styles.errorRow}>
        <GaloyIcon
          name="warning"
          size={14}
          color={hasError ? colors.error : "transparent"}
        />
        <Text type="p3" color={hasError ? colors.error : "transparent"}>
          {errorMessage || " "}
        </Text>
      </View>
      <View style={styles.keyboardContainer}>
        <CurrencyKeyboard onPress={onKeyPress} disabledKeys={disabledKeys} safeMode />
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: { alignSelf: "stretch" },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  keyboardContainer: {
    alignSelf: "stretch",
  },
}))
