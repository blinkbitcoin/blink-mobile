import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsGroup } from "../group"
import { SettingsRow } from "../row"

const ACCOUNT_ID_MASK = "\u2022".repeat(20)

export const AccountId: React.FC = () => {
  const { data, loading } = useSettingsScreenQuery()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const {
    theme: { colors },
  } = useTheme()

  const accountId = data?.me?.defaultAccount?.id || ""
  const last6digitsOfAccountId = accountId?.slice(-6).toUpperCase()
  const maskedAccountId = `${ACCOUNT_ID_MASK} ${last6digitsOfAccountId}`

  const AccountIdRow = () => (
    <SettingsRow
      loading={loading}
      title={maskedAccountId}
      action={null}
      rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary} />}
      rightIconAction={() =>
        copyToClipboard({
          content: accountId,
          message: LL.AccountScreen.copiedAccountId(),
        })
      }
    />
  )
  AccountIdRow.displayName = "AccountIdRow"

  return <SettingsGroup name={LL.AccountScreen.accountId()} items={[AccountIdRow]} />
}
