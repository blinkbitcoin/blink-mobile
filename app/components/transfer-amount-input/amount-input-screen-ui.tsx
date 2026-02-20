import * as React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { Key } from "@app/components/amount-input-screen/number-pad-reducer"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
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

  return (
    <View style={styles.amountInputScreenContainer}>
      <View style={styles.bodyContainer}>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage} />}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} disabledKeys={disabledKeys} safeMode />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  amountInputScreenContainer: { alignSelf: "stretch" },
  infoContainer: {
    justifyContent: "flex-start",
  },
  bodyContainer: {},
  keyboardContainer: {
    alignSelf: "stretch",
  },
}))
