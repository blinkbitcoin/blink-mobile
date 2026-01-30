import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { WalletCurrency } from "@app/graphql/generated";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { usePriceConversion } from "@app/hooks";
import { addMoneyAmounts, toBtcMoneyAmount, toUsdMoneyAmount, DisplayCurrency, } from "@app/types/amounts";
export var useTotalBalance = function (wallets) {
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    // TODO: check that there are 2 wallets.
    // otherwise fail (account with more/less 2 wallets will not be working with the current mobile app)
    // some tests accounts have only 1 wallet
    var btcWallet = getBtcWallet(wallets);
    var usdWallet = getUsdWallet(wallets);
    var btcAmount = convertMoneyAmount === null || convertMoneyAmount === void 0 ? void 0 : convertMoneyAmount(toBtcMoneyAmount(btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance), DisplayCurrency);
    var usdAmount = convertMoneyAmount === null || convertMoneyAmount === void 0 ? void 0 : convertMoneyAmount(toUsdMoneyAmount(usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance), DisplayCurrency);
    if (!btcAmount || !usdAmount) {
        return {
            formattedBalance: "$0.00",
            numericBalance: 0,
            satsBalance: 0,
        };
    }
    var totalDisplay = addMoneyAmounts({ a: usdAmount, b: btcAmount });
    var integerBalanceString = formatMoneyAmount({
        moneyAmount: totalDisplay,
        noSymbol: true,
        noSuffix: true,
    });
    var numericBalance = Number(integerBalanceString);
    var totalBtc = convertMoneyAmount === null || convertMoneyAmount === void 0 ? void 0 : convertMoneyAmount(totalDisplay, WalletCurrency.Btc);
    var satsBalance = !(usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance) && (btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance) ? btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance : (totalBtc === null || totalBtc === void 0 ? void 0 : totalBtc.amount) || 0;
    return {
        formattedBalance: formatMoneyAmount({ moneyAmount: totalDisplay }),
        numericBalance: isNaN(numericBalance) ? 0 : numericBalance,
        satsBalance: isNaN(satsBalance) ? 0 : satsBalance,
    };
};
//# sourceMappingURL=use-total-balance.js.map