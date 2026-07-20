import React from "react"
import { Linking } from "react-native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"
import { extractLightningAddressUsername } from "@app/utils/pay-links"

import { SettingsRow } from "../row"
import { useSelfCustodialLightningAddress } from "./use-self-custodial-lightning-address"

const DONATION_BUTTON_URL = "https://donation-button.blink.sv"

export const AccountDonationButton: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const address = useSelfCustodialLightningAddress()
  const username = extractLightningAddressUsername(address)

  // Non-custodial only; custodial mode keeps the printable static QR item instead.
  if (activeAccount?.type !== AccountType.SelfCustodial) return null
  if (!username) return null

  return (
    <SettingsRow
      title={LL.SettingsScreen.donationButton()}
      leftGaloyIcon="qr-code"
      rightIcon={<GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />}
      action={() => {
        Linking.openURL(`${DONATION_BUTTON_URL}/${username}`)
      }}
    />
  )
}
