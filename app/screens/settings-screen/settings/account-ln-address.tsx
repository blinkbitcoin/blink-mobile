import React, { useState } from "react"

import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"

import { SettingsRow } from "../row"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useTheme } from "@rn-vui/themed"

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
            Clipboard.setString(lnAddress)
            toastShow({
              type: "success",
              message: (translations) =>
                translations.GaloyAddressScreen.copiedLightningAddressToClipboard(),
              LL,
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
