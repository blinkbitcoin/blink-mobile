import { WalletCurrency } from "@app/graphql/generated";
export var getBtcWallet = function (wallets) {
    if (wallets === undefined || wallets.length === 0) {
        return undefined;
    }
    return wallets.find(function (wallet) { return wallet.walletCurrency === WalletCurrency.Btc; });
};
export var getUsdWallet = function (wallets) {
    if (wallets === undefined || wallets.length === 0) {
        return undefined;
    }
    return wallets.find(function (wallet) { return wallet.walletCurrency === WalletCurrency.Usd; });
};
export var getDefaultWallet = function (wallets, defaultWalletId) {
    if (wallets === undefined || wallets.length === 0) {
        return undefined;
    }
    return wallets.find(function (wallet) { return wallet.id === defaultWalletId; });
};
//# sourceMappingURL=wallets-utils.js.map