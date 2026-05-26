import * as React from "react"
import { useCallback, useRef } from "react"
import { Modal, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { makeStyles } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { AmountInputScreen } from "../amount-input-screen"

export type AmountInputModalProps = {
  moneyAmount?: MoneyAmount<WalletOrDisplayCurrency>
  walletCurrency: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  onSetAmount?: (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => void
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  maxAmountIsBalance?: boolean
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
  isOpen: boolean
  close: () => void
}

/**
 * TODO: switch back to `@gorhom/bottom-sheet` when v6 is released.
 *
 * `@gorhom/bottom-sheet` 5.2.x is incompatible with our current stack
 * (React Native 0.85 + react-native-reanimated v4 + New Architecture/Fabric):
 * `present()` runs but the sheet never animates in and stays invisible at
 * runtime. The upstream PR that ports the library to reanimated v4 will only
 * land in v6, not in the 5.2.x line.
 *
 * Refs (all OPEN at the time of writing):
 * - https://github.com/gorhom/react-native-bottom-sheet/issues/2683 — same RN 0.85 + reanimated v4 stack reporting the silent render failure
 * - https://github.com/gorhom/react-native-bottom-sheet/issues/2685 — reanimated v4 regression in 5.2.14
 * - https://github.com/gorhom/react-native-bottom-sheet/pull/2660 — reanimated v4 support PR (not merged, deferred to v6)
 * - https://github.com/gorhom/react-native-bottom-sheet/pull/2667 — gorhom's v6 rework targeting reanimated v4 + Fabric
 *
 * Until v6 ships we use React Native's built-in `Modal`, which renders via
 * the platform's native modal stack and so isn't affected by the reanimated
 * v4 incompatibility. Trade-off vs gorhom: no interactive pan-down-to-close
 * (tap-on-backdrop dismisses instead).
 */
export const AmountInputModal: React.FC<AmountInputModalProps> = ({
  moneyAmount,
  walletCurrency,
  onSetAmount,
  maxAmount,
  maxAmountIsBalance,
  minAmount,
  convertMoneyAmount,
  isOpen,
  close,
}) => {
  const { bottom } = useSafeAreaInsets()
  const styles = useStyles({ bottom })
  const pendingSetAmountRef = useRef<MoneyAmount<WalletOrDisplayCurrency> | undefined>(
    undefined,
  )

  const handleDismiss = useCallback(() => {
    close()

    const pendingAmount = pendingSetAmountRef.current
    if (!pendingAmount || !onSetAmount) return

    pendingSetAmountRef.current = undefined
    onSetAmount(pendingAmount)
  }, [close, onSetAmount])

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleIndicator} />
          <AmountInputScreen
            initialAmount={moneyAmount}
            convertMoneyAmount={convertMoneyAmount}
            walletCurrency={walletCurrency}
            setAmount={
              onSetAmount &&
              ((amount) => {
                pendingSetAmountRef.current = amount
                handleDismiss()
              })
            }
            maxAmount={maxAmount}
            maxAmountIsBalance={maxAmountIsBalance}
            minAmount={minAmount}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }, { bottom }: { bottom: number }) => ({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    paddingBottom: bottom,
    paddingTop: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.grey4,
    borderBottomWidth: 0,
  },
  handleIndicator: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginBottom: 8,
  },
}))
