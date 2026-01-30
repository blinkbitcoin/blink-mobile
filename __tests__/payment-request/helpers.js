import { WalletCurrency } from "@app/graphql/generated";
import { Invoice, } from "@app/screens/receive-bitcoin-screen/payment/index.types";
export var btcWalletDescriptor = {
    id: "btc-wallet-id",
    currency: WalletCurrency.Btc,
};
export var usdWalletDescriptor = {
    id: "usd-wallet-id",
    currency: WalletCurrency.Usd,
};
export var convertMoneyAmountFn = function (amount, toCurrency) {
    return { amount: amount.amount, currency: toCurrency, currencyCode: toCurrency };
};
export var defaultParams = {
    type: Invoice.Lightning,
    defaultWalletDescriptor: btcWalletDescriptor,
    bitcoinWalletDescriptor: btcWalletDescriptor,
    convertMoneyAmount: convertMoneyAmountFn,
    network: "mainnet",
    posUrl: "pos-url",
    lnAddressHostname: "ln-addr-host",
};
//# sourceMappingURL=helpers.js.map