import React, { useState } from "react"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BackupRequiredModal } from "@app/components/backup-required-modal"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { SetSelfCustodialLightningAddressModal } from "@app/screens/settings-screen/self-custodial/set-lightning-address-modal"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig, useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useLightningAddressGated } from "@app/self-custodial/hooks/use-lightning-address-gate"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"
import { getLightningAddress } from "@app/utils/pay-links"

import { SettingsRow } from "../row"
import { useSelfCustodialLightningAddress } from "./use-self-custodial-lightning-address"

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
  /** Marks the address as unusable: the row says so and drops the copy affordance,
   *  while `address` stays the bare address so nothing can copy the label. */
  isDisabled?: boolean
  renderModal: (modal: { isVisible: boolean; toggleModal: () => void }) => React.ReactNode
}

const LightningAddressRow: React.FC<LightningAddressRowProps> = ({
  address,
  loading,
  isDisabled = false,
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

  const isAddressCopyable = Boolean(address) && !isDisabled
  const disabledSuffix = isDisabled ? ` ${LL.SettingsScreen.addressDisabled()}` : ""
  const displayedTitle = address
    ? `${address}${disabledSuffix}`
    : LL.SettingsScreen.createAddress()

  /** A disabled address is inert both ways: the label is not an address, so copying it
   *  would hand the user a string no wallet can pay, and registering a new one is the
   *  very thing being withheld. Otherwise the row creates an address or copies it. */
  const handleAction = () => {
    if (isDisabled) return
    if (!address) {
      toggleModal()
      return
    }
    copyAddress(address)
  }

  return (
    <>
      <SettingsRow
        loading={loading}
        title={displayedTitle}
        subtitleShorter={displayedTitle.length > SUBTITLE_SHORTER_LENGTH}
        leftGaloyIcon="lightning-address"
        rightIcon={
          isAddressCopyable ? (
            <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
          ) : undefined
        }
        action={handleAction}
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
  const address = useSelfCustodialLightningAddress()
  const { backupState } = useBackupState()
  const isLightningAddressGated = useLightningAddressGated()
  const isBackupRequired = backupState.status !== BackupStatus.Completed

  return (
    <LightningAddressRow
      address={address}
      /** Incognito cannot receive, so the row says so next to the address it still shows. */
      isDisabled={isLightningAddressGated}
      renderModal={({ isVisible, toggleModal }) =>
        isBackupRequired ? (
          <BackupRequiredModal isVisible={isVisible} onClose={toggleModal} />
        ) : (
          <SetSelfCustodialLightningAddressModal
            isVisible={isVisible}
            toggleModal={toggleModal}
          />
        )
      }
    />
  )
}
