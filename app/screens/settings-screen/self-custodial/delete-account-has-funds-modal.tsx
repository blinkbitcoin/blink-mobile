import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { testProps } from "@app/utils/testProps"

type Props = {
  isVisible: boolean
  onClose: () => void
}

export const DeleteAccountHasFundsModal: React.FC<Props> = ({ isVisible, onClose }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { wallets } = useSelfCustodialWallet()
  const { formatMoneyAmount } = useDisplayCurrency()

  const balanceText = wallets
    .filter((w) => w.balance.amount > 0)
    .map((w) => formatMoneyAmount({ moneyAmount: w.balance }))
    .join(" + ")

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onClose}
      showCloseIconButton={true}
      image={<GaloyIcon name="warning" size={48} color={colors.warning} />}
      title={LL.SelfCustodialDelete.hasFundsWarningTitle()}
      body={
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            {LL.SelfCustodialDelete.hasFundsWarningBody({ balance: balanceText })}
          </Text>
          <Text style={styles.paragraph}>
            {LL.SelfCustodialDelete.hasFundsWarningHelper()}
          </Text>
        </View>
      }
      primaryButtonTitle={LL.SelfCustodialDelete.hasFundsWarningButton()}
      primaryButtonOnPress={onClose}
      {...testProps("self-custodial-has-funds-warning-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    rowGap: 16,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
}))
