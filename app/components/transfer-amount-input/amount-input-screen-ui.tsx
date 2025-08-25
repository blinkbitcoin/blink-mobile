import * as React from "react"
import { View } from "react-native"

import { makeStyles } from "@rneui/themed"

import { GaloyErrorBox } from "../atomic/galoy-error-box"
import { CurrencyKeyboard } from "../currency-keyboard"
import { Key } from "../amount-input-screen/number-pad-reducer"

export type AmountInputScreenUIProps = {
  errorMessage?: string
  onKeyPress: (key: Key) => void
  onClearAmount: () => void
  onPaste: (keys: number) => void
  responsive?: boolean
}

export const AmountInputScreenUI: React.FC<AmountInputScreenUIProps> = ({
  errorMessage,
  onKeyPress,
  responsive = false,
}) => {
  const styles = useStyles(responsive)

  return (
    <View style={styles.amountInputScreenContainer}>
      <View style={styles.bodyContainer}>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage} />}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} responsive={responsive} />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({}, responsive: boolean) => ({
  amountInputScreenContainer: {
    flex: 1,
  },

  infoContainer: {
    justifyContent: "flex-start",
    ...(responsive ? {} : { flex: 1 }),
  },
  bodyContainer: {
    flex: 1,
    ...(responsive ? {} : { padding: 24 }),
  },

  keyboardContainer: {
    ...(responsive ? { flex: 1 } : { paddingHorizontal: 16, marginBottom: 30 }),
  },
}))
