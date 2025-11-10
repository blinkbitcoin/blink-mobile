import * as React from "react"
import { SafeAreaView } from "react-native"
import ReactNativeModal from "react-native-modal"

import { WalletCurrency } from "@app/graphql/generated"
import { timing } from "@app/rne-theme/timing"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { makeStyles } from "@rn-vui/themed"

import { AmountInputScreen } from "../amount-input-screen"

export type AmountInputModalProps = {
  moneyAmount?: MoneyAmount<WalletOrDisplayCurrency>
  walletCurrency: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  onSetAmount?: (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => void
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
  isOpen: boolean
  close: () => void
}

export const AmountInputModal: React.FC<AmountInputModalProps> = ({
  moneyAmount,
  walletCurrency,
  onSetAmount,
  maxAmount,
  minAmount,
  convertMoneyAmount,
  isOpen,
  close,
}) => {
  const styles = useStyles()

  return (
    <ReactNativeModal
      isVisible={isOpen}
      coverScreen={true}
      style={styles.modal}
      animationInTiming={timing.quick}
    >
      <SafeAreaView style={styles.amountInputScreenContainer}>
        <AmountInputScreen
          initialAmount={moneyAmount}
          convertMoneyAmount={convertMoneyAmount}
          walletCurrency={walletCurrency}
          setAmount={onSetAmount}
          maxAmount={maxAmount}
          minAmount={minAmount}
          goBack={close}
        />
      </SafeAreaView>
    </ReactNativeModal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  amountInputScreenContainer: {
    flex: 1,
  },
  modal: {
    backgroundColor: colors.white,
    margin: 0,
  },
}))
