var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { useEffect, useState } from "react";
import { WalletCurrency } from "@app/graphql/generated";
import { ConvertInputType } from "@app/components/transfer-amount-input";
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts";
export var useSyncedInputValues = function (_a) {
    var fromWallet = _a.fromWallet, toWallet = _a.toWallet, initialCurrencyInput = _a.initialCurrencyInput;
    var _b = useState(__assign({ fromInput: {
            id: ConvertInputType.FROM,
            currency: WalletCurrency.Btc,
            amount: toBtcMoneyAmount(0),
            isFocused: false,
            formattedAmount: "",
        }, toInput: {
            id: ConvertInputType.TO,
            currency: WalletCurrency.Usd,
            amount: toUsdMoneyAmount(0),
            isFocused: false,
            formattedAmount: "",
        } }, initialCurrencyInput)), inputValues = _b[0], setInputValues = _b[1];
    useEffect(function () {
        if (fromWallet && toWallet) {
            setInputValues(function (prev) {
                var fromCurrency = fromWallet.walletCurrency;
                var toCurrency = toWallet.walletCurrency;
                var fromAmount = fromCurrency === WalletCurrency.Btc
                    ? toBtcMoneyAmount(prev.fromInput.amount.amount)
                    : toUsdMoneyAmount(prev.fromInput.amount.amount);
                var toAmount = toCurrency === WalletCurrency.Btc
                    ? toBtcMoneyAmount(prev.toInput.amount.amount)
                    : toUsdMoneyAmount(prev.toInput.amount.amount);
                return __assign(__assign({}, prev), { fromInput: __assign(__assign({}, prev.fromInput), { currency: fromCurrency, amount: fromAmount }), toInput: __assign(__assign({}, prev.toInput), { currency: toCurrency, amount: toAmount }) });
            });
        }
    }, [fromWallet, fromWallet === null || fromWallet === void 0 ? void 0 : fromWallet.walletCurrency, toWallet, toWallet === null || toWallet === void 0 ? void 0 : toWallet.walletCurrency]);
    return { inputValues: inputValues, setInputValues: setInputValues };
};
//# sourceMappingURL=use-synced-input-values.js.map