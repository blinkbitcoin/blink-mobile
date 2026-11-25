import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { MultiLineField } from "@app/components/card-screen"
import { CheckboxRow } from "@app/components/checkbox-row"
import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"
import { groupTitleGap } from "@app/rne-theme/tokens"

import { ShippingAddress } from "./types"
import { addressToLines } from "./utils"

type KycAddressChoiceProps = {
  kycAddress: ShippingAddress | null
  isKycAddressUsed: boolean
  onToggle: () => void
  /** The address form, shown while the KYC address is not chosen. */
  children: React.ReactNode
}

/** The KYC address as a choice, never the default: an unticked box at the top, with the
 *  address form under it (D42, D123). Nothing to offer while there is no KYC address. */
export const KycAddressChoice: React.FC<KycAddressChoiceProps> = ({
  kycAddress,
  isKycAddressUsed,
  onToggle,
  children,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const addressLL = LL.CardFlow.ShippingAddress
  /** Set only while the KYC address is the one chosen. */
  const chosenKycAddressLines =
    kycAddress && isKycAddressUsed ? addressToLines(kycAddress, false) : null

  return (
    <View style={styles.container}>
      {kycAddress && (
        <CheckboxRow
          label={addressLL.useKycAddress()}
          isChecked={isKycAddressUsed}
          onPress={onToggle}
        />
      )}

      {chosenKycAddressLines ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{addressLL.kycAddress()}</Text>
          <MultiLineField lines={chosenKycAddressLines} leftIcon="map-pin" />
        </View>
      ) : (
        children
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 17,
  },
  section: {
    gap: groupTitleGap,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
}))
