import { useSettingsScreenQuery, WalletCurrency } from "@app/graphql/generated"

export const useNwcBtcBalance = () => {
  const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })

  return data?.me?.defaultAccount.wallets.find(
    (wallet) => wallet.walletCurrency === WalletCurrency.Btc,
  )?.balance
}
