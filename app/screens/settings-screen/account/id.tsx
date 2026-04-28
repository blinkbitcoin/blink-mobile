import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { AccountType } from "@app/types/wallet.types"

import { SettingsGroup } from "../group"
import { SettingsRow } from "../row"

const ACCOUNT_ID_MASK = "\u2022".repeat(20)

const maskId = (id: string) => `${ACCOUNT_ID_MASK} ${id.slice(-6).toUpperCase()}`

export const AccountId: React.FC = () => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  const { data, loading: custodialLoading } = useSettingsScreenQuery({
    skip: isSelfCustodial,
  })
  const { identityPubkey, loading: selfCustodialLoading } = useSelfCustodialAccountInfo()

  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const {
    theme: { colors },
  } = useTheme()

  const accountId = isSelfCustodial ? identityPubkey : data?.me?.defaultAccount?.id || ""
  const loading = isSelfCustodial ? selfCustodialLoading : custodialLoading
  const sectionName = isSelfCustodial
    ? LL.AccountScreen.publicKey()
    : LL.AccountScreen.accountId()
  const copiedMessage = isSelfCustodial
    ? LL.AccountScreen.copiedPublicKey()
    : LL.AccountScreen.copiedAccountId()

  const AccountIdRow = () => {
    if (!loading && !accountId) return null
    return (
      <SettingsRow
        loading={loading}
        title={maskId(accountId)}
        action={null}
        rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary} />}
        rightIconAction={() =>
          copyToClipboard({
            content: accountId,
            message: copiedMessage,
          })
        }
      />
    )
  }
  AccountIdRow.displayName = "AccountIdRow"

  return <SettingsGroup name={sectionName} items={[AccountIdRow]} />
}
