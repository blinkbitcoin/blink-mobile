import React from "react"
import { Linking } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { QrCodeIcon } from "phosphor-react-native"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"
import { useTheme } from "@rn-vui/themed"

export const AccountStaticQR: React.FC = () => {
  const { appConfig } = useAppConfig()
  const {
    theme: { colors },
  } = useTheme()
  const posUrl = appConfig.galoyInstance.posUrl

  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const { isSelfCustodial } = useActiveWallet()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  if (isSelfCustodial) return null
  if (!data?.me?.username) return null

  const qrUrl = `${posUrl}/${data.me.username}/print`

  return (
    <SettingsRow
      loading={loading}
      title={LL.SettingsScreen.staticQr()}
      subtitleShorter={true}
      leftGaloyIcon={<QrCodeIcon size={20} color={colors.black} />}
      rightIcon={<GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />}
      action={() => {
        Linking.openURL(qrUrl)
      }}
    />
  )
}
