import { Wallet } from "@app/graphql/generated"

type ConvertWalletFragment = Pick<Wallet, "id" | "balance" | "walletCurrency">

type InitialConvertWallets = {
  initialFromWallet: ConvertWalletFragment
  initialToWallet: ConvertWalletFragment
}

/**
 * The wallets the convert screen opens with. A drain empties dollars into bitcoin, and a
 * restricted investor may only move that way, so those open USD to BTC; every other
 * entry keeps the screen's usual BTC to USD default. Undefined until both wallets are
 * known, matching the convert hook's "no wallets yet" state.
 */
export const resolveInitialConvertWallets = (
  btcWallet: ConvertWalletFragment | undefined,
  usdWallet: ConvertWalletFragment | undefined,
  isUsdToBtc: boolean,
): InitialConvertWallets | undefined => {
  if (!btcWallet || !usdWallet) return undefined

  return isUsdToBtc
    ? { initialFromWallet: usdWallet, initialToWallet: btcWallet }
    : { initialFromWallet: btcWallet, initialToWallet: usdWallet }
}
