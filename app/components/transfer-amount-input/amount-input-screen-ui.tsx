import * as React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { CurrencyKeyboard } from "@app/components/currency-keyboard"
import { Key } from "@app/components/amount-input-screen/number-pad-reducer"

export type AmountInputScreenUIProps = {
  errorMessage?: string
  onKeyPress: (key: Key) => void
  onClearAmount: () => void
  onPaste: (keys: number) => void
  compact?: boolean
}

export const AmountInputScreenUI: React.FC<AmountInputScreenUIProps> = ({
  errorMessage,
  onKeyPress,
  compact = false,
}) => {
  const styles = useStyles(compact)

  return (
    <View style={styles.amountInputScreenContainer}>
      <View style={styles.bodyContainer}>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage} />}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} compact={compact} safeMode />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles((_, compact: boolean) => ({
  amountInputScreenContainer: { alignSelf: "stretch" },
  infoContainer: {
    justifyContent: "flex-start",
    ...(compact ? {} : { flex: 1 }),
  },
  bodyContainer: {
    ...(compact ? {} : { padding: 24 }),
  },
  keyboardContainer: {
    ...(compact ? { alignSelf: "stretch" } : { paddingHorizontal: 16, marginBottom: 30 }),
  },
}))
