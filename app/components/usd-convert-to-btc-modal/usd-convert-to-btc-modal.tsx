import * as React from "react"
import { View } from "react-native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useIntraLedgerConversion } from "@app/hooks/use-intra-ledger-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UsdMoneyAmount } from "@app/types/amounts"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

import { UsdConvertAmountRows } from "./usd-convert-amount-rows"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
  usdWalletId: string
  btcWalletId: string
}

export const UsdConvertToBtcModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
  usdWalletId,
  btcWalletId,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const { execute, loading, errorMessage } = useIntraLedgerConversion({
    onSuccess: toggleModal,
  })

  const convertBalance = () =>
    execute({
      fromWallet: { id: usdWalletId, currency: WalletCurrency.Usd },
      toWallet: { id: btcWalletId, currency: WalletCurrency.Btc },
      fromAmount: usdWalletBalance.amount,
    })

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="clock" size={80} color={colors.primary3} />}
      title={LL.ConvertDollarToBitcoinModal.title()}
      titleMaxWidth="100%"
      body={
        <>
          <UsdConvertAmountRows usdWalletBalance={usdWalletBalance} />
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <GaloyErrorBox errorMessage={errorMessage} />
            </View>
          ) : null}
        </>
      }
      primaryButtonTitle={LL.ConvertDollarToBitcoinModal.approve()}
      primaryButtonOnPress={convertBalance}
      primaryButtonLoading={loading}
      primaryButtonDisabled={loading}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(() => ({
  errorContainer: {
    marginTop: 16,
  },
}))
