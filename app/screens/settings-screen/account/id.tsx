import { useCallback } from "react"

import Clipboard from "@react-native-clipboard/clipboard"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { SettingsGroup } from "../group"
import { SettingsRow } from "../row"

const ACCOUNT_ID_MASK = "\u2022".repeat(20)

export const AccountId: React.FC = () => {
  const { data, loading } = useSettingsScreenQuery()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const accountId = data?.me?.defaultAccount?.id || ""
  const last6digitsOfAccountId = accountId?.slice(-6).toUpperCase()
  const maskedAccountId = `${ACCOUNT_ID_MASK} ${last6digitsOfAccountId}`

  const copyToClipboard = useCallback(() => {
    Clipboard.setString(accountId)
    toastShow({
      message: (translations) => {
        return translations.AccountScreen.copiedAccountId()
      },
      type: "success",
      LL,
    })
  }, [LL, accountId])

  const AccountIdRow = () => (
    <SettingsRow
      loading={loading}
      title={maskedAccountId}
      action={null}
      rightIcon={<GaloyIcon name="copy-paste" size={24} color={colors.primary} />}
      rightIconAction={copyToClipboard}
    />
  )

  return <SettingsGroup name={LL.AccountScreen.accountId()} items={[AccountIdRow]} />
}
