import { Wallet } from "@app/graphql/generated"

type ConvertWalletFragment = Pick<Wallet, "id" | "balance" | "walletCurrency">

type InitialConvertWallets = {
  initialFromWallet: ConvertWalletFragment
  initialToWallet: ConvertWalletFragment
}

/**
 * The wallets the convert screen opens with. A migration conversion empties dollars into
 * bitcoin, so it opens USD to BTC; every other entry keeps the screen's usual BTC to USD
 * default. Undefined until both wallets are known, matching the convert hook's "no wallets
 * yet" state.
 */
export const resolveInitialConvertWallets = (
  btcWallet: ConvertWalletFragment | undefined,
  usdWallet: ConvertWalletFragment | undefined,
  isMigrationConversion: boolean,
): InitialConvertWallets | undefined => {
  if (!btcWallet || !usdWallet) return undefined

  return isMigrationConversion
    ? { initialFromWallet: usdWallet, initialToWallet: btcWallet }
    : { initialFromWallet: btcWallet, initialToWallet: usdWallet }
}
