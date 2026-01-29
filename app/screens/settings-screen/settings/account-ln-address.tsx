import React, { useState } from "react"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"

export const AccountLNAddress: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const hostName = appConfig.galoyInstance.lnAddressHostname

  const [isModalShown, setModalShown] = useState(false)
  const toggleModalVisibility = () => setModalShown((x) => !x)

  const { data, loading } = useSettingsScreenQuery()

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
