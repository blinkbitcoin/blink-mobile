import * as React from "react"
import { View } from "react-native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UsdMoneyAmount } from "@app/types/amounts"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

import { UsdConvertAmountRows } from "./usd-convert-amount-rows"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
  onConvert: () => void
  loading: boolean
  disabled?: boolean
  errorMessage?: string
}

export const ConvertToBtcModalUI: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
  onConvert,
  loading,
  disabled = false,
  errorMessage,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const isConvertDisabled = loading || disabled

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="warning" size={80} color={colors.primary} />}
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
      primaryButtonTitle={LL.ConversionDetailsScreen.transfer()}
      primaryButtonOnPress={onConvert}
      primaryButtonLoading={loading}
      primaryButtonDisabled={isConvertDisabled}
      showCloseIconButton={false}
      dismissable={false}
    />
  )
}

const useStyles = makeStyles(() => ({
  errorContainer: {
    marginTop: 16,
  },
}))
