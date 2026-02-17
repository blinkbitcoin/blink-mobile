import * as React from "react"
import { useCallback, useEffect, useRef } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { makeStyles } from "@rn-vui/themed"
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet"

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
  const { bottom } = useSafeAreaInsets()
  const bottomSheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.present()
    }
  }, [isOpen])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  )

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      enablePanDownToClose
      animationConfigs={{ duration: 300 }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
      onDismiss={close}
    >
      <BottomSheetView style={{ paddingBottom: bottom }}>
        <AmountInputScreen
          initialAmount={moneyAmount}
          convertMoneyAmount={convertMoneyAmount}
          walletCurrency={walletCurrency}
          setAmount={
            onSetAmount &&
            ((amount) => {
              onSetAmount(amount)
              bottomSheetRef.current?.dismiss()
            })
          }
          maxAmount={maxAmount}
          minAmount={minAmount}
        />
      </BottomSheetView>
    </BottomSheetModal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  handleIndicator: {
    backgroundColor: colors.grey3,
    width: 40,
    height: 4,
  },
  sheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.grey4,
    borderBottomWidth: 0,
    marginHorizontal: -1,
  },
}))
