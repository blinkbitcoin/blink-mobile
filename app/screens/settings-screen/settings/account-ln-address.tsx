import React, { useState } from "react"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { SetSelfCustodialLightningAddressModal } from "@app/screens/settings-screen/self-custodial/set-lightning-address-modal"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig, useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { getLightningAddress } from "@app/utils/pay-links"

import { SettingsRow } from "../row"

const SUBTITLE_SHORTER_LENGTH = 22

export const AccountLNAddress: React.FC = () => {
  const { activeAccount } = useAccountRegistry()

  if (activeAccount?.type === AccountType.SelfCustodial) {
    return <SelfCustodialLightningAddressRow />
  }
  return <CustodialLightningAddressRow />
}

type LightningAddressRowProps = {
  address: string | null
  loading?: boolean
  renderModal: (modal: { isVisible: boolean; toggleModal: () => void }) => React.ReactNode
}

const LightningAddressRow: React.FC<LightningAddressRowProps> = ({
  address,
  loading,
  renderModal,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const [isModalShown, setModalShown] = useState(false)
  const toggleModal = () => setModalShown((shown) => !shown)

  const copyAddress = (value: string) =>
    copyToClipboard({
      content: value,
      message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
    })

  return (
    <>
      <SettingsRow
        loading={loading}
        title={address ?? LL.SettingsScreen.setYourLightningAddress()}
        subtitleShorter={(address ?? "").length > SUBTITLE_SHORTER_LENGTH}
        leftGaloyIcon="lightning-address"
        rightIcon={
          address ? (
            <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
          ) : undefined
        }
        action={address ? () => copyAddress(address) : toggleModal}
      />
      {renderModal({ isVisible: isModalShown, toggleModal })}
    </>
  )
}

const CustodialLightningAddressRow: React.FC = () => {
  const { appConfig } = useAppConfig()
  const isAuthed = useIsAuthed()
  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })

  const username = data?.me?.username
  const address = username
    ? getLightningAddress(appConfig.galoyInstance.lnAddressHostname, username)
    : null

  return (
    <LightningAddressRow
      address={address}
      loading={loading}
      renderModal={({ isVisible, toggleModal }) => (
        <SetLightningAddressModal isVisible={isVisible} toggleModal={toggleModal} />
      )}
    />
  )
}

const SelfCustodialLightningAddressRow: React.FC = () => {
  const { activeAccount, selfCustodialEntries } = useAccountRegistry()
  const { lightningAddress: liveLightningAddress } = useSelfCustodialWallet()

  const persistedLightningAddress =
    selfCustodialEntries.find((entry) => entry.id === activeAccount?.id)
      ?.lightningAddress ?? null

  /**
   * Prefer the live SDK address but fall back to the persisted one while the SDK
   * reconnects, so a user who already registered never sees the "set" prompt.
   */
  const address = liveLightningAddress ?? persistedLightningAddress

  return (
    <LightningAddressRow
      address={address}
      renderModal={({ isVisible, toggleModal }) => (
        <SetSelfCustodialLightningAddressModal
          isVisible={isVisible}
          toggleModal={toggleModal}
        />
      )}
    />
  )
}
