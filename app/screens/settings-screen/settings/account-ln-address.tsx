import React, { useState } from "react"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig, useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { AccountType } from "@app/types/wallet.types"

import { SettingsRow } from "../row"

export const AccountLNAddress: React.FC = () => {
  const { activeAccount } = useAccountRegistry()
  const { lightningAddress: selfCustodialLightningAddress } = useSelfCustodialWallet()

  if (activeAccount?.type === AccountType.SelfCustodial) {
    if (!selfCustodialLightningAddress) return null
    return <SelfCustodialLightningAddressRow />
  }
  return <CustodialLightningAddressRow />
}

const CustodialLightningAddressRow: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const hostName = appConfig.galoyInstance.lnAddressHostname

  const [isModalShown, setModalShown] = useState(false)
  const toggleModalVisibility = () => setModalShown((x) => !x)

  const isAuthed = useIsAuthed()
  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })

  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()

  const hasUsername = Boolean(data?.me?.username)
  const lnAddress = `${data?.me?.username}@${hostName}`

  return (
    <>
      <SettingsRow
        loading={loading}
        title={hasUsername ? lnAddress : LL.SettingsScreen.setYourLightningAddress()}
        subtitleShorter={(data?.me?.username || "").length > 22}
        leftGaloyIcon="lightning-address"
        rightIcon={
          hasUsername ? (
            <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
          ) : undefined
        }
        action={() => {
          if (hasUsername) {
            copyToClipboard({
              content: lnAddress,
              message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
            })
          } else {
            toggleModalVisibility()
          }
        }}
      />
      <SetLightningAddressModal
        isVisible={isModalShown}
        toggleModal={toggleModalVisibility}
      />
    </>
  )
}

const SelfCustodialLightningAddressRow: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { lightningAddress } = useSelfCustodialWallet()
  const { copyToClipboard } = useClipboard()

  if (!lightningAddress) return null

  return (
    <SettingsRow
      title={lightningAddress}
      subtitleShorter={lightningAddress.length > 22}
      leftGaloyIcon="lightning-address"
      rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary} />}
      action={() =>
        copyToClipboard({
          content: lightningAddress,
          message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
        })
      }
    />
  )
}
