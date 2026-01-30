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
import React from "react";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { DisplayCurrency } from "@app/types/amounts";
import { usePriceConversion } from "../../hooks/use-price-conversion";
export var useConvertMoneyDetails = function (params) {
    var _a = usePriceConversion(), convertMoneyAmount = _a.convertMoneyAmount, convertMoneyAmountWithRounding = _a.convertMoneyAmountWithRounding;
    var zeroDisplayAmount = useDisplayCurrency().zeroDisplayAmount;
    var _b = React.useState(function () {
        if (params) {
            // if the from wallet is empty, swap the wallets
            if (params.initialFromWallet.balance === 0) {
                return {
                    fromWallet: params.initialToWallet,
                    toWallet: params.initialFromWallet,
                };
            }
            return {
                fromWallet: params.initialFromWallet,
                toWallet: params.initialToWallet,
            };
        }
        return undefined;
    }), wallets = _b[0], _setWallets = _b[1];
    var _c = React.useState(zeroDisplayAmount), moneyAmount = _c[0], setMoneyAmount = _c[1];
    var setWallets = function (wallets) {
        _setWallets(wallets);
    };
    if (!wallets || !convertMoneyAmount || !convertMoneyAmountWithRounding) {
        return {
            moneyAmount: moneyAmount,
            setMoneyAmount: setMoneyAmount,
            setWallets: setWallets,
            displayAmount: undefined,
            settlementSendAmount: undefined,
            settlementReceiveAmount: undefined,
            toggleAmountCurrency: undefined,
            convertMoneyAmount: undefined,
            fromWallet: undefined,
            toWallet: undefined,
            canToggleWallet: false,
            toggleWallet: undefined,
            isValidAmount: false,
        };
    }
    var fromWallet = wallets.fromWallet, toWallet = wallets.toWallet;
    var toggleAmountCurrency = function () {
        setMoneyAmount(convertMoneyAmount(moneyAmount, moneyAmount.currency === DisplayCurrency
            ? fromWallet.walletCurrency
            : DisplayCurrency));
    };
    var toggleWallet = {
        canToggleWallet: true,
        toggleWallet: function () {
            setWallets({
                fromWallet: wallets.toWallet,
                toWallet: wallets.fromWallet,
            });
            setMoneyAmount(convertMoneyAmount(moneyAmount, DisplayCurrency));
        },
    };
    var settlementSendAmount = convertMoneyAmount(moneyAmount, fromWallet.walletCurrency);
    var settlementReceiveAmount = convertMoneyAmount(moneyAmount, toWallet.walletCurrency);
    var settlementReceiveAmountRoundedDown = convertMoneyAmountWithRounding(moneyAmount, toWallet.walletCurrency, Math.floor);
    return __assign({ moneyAmount: moneyAmount, setMoneyAmount: setMoneyAmount, displayAmount: convertMoneyAmount(moneyAmount, DisplayCurrency), setWallets: setWallets, settlementSendAmount: settlementSendAmount, settlementReceiveAmount: settlementReceiveAmount, toggleAmountCurrency: toggleAmountCurrency, convertMoneyAmount: convertMoneyAmount, fromWallet: fromWallet, toWallet: toWallet, isValidAmount: settlementSendAmount.amount <= fromWallet.balance &&
            settlementSendAmount.amount > 0 &&
            settlementReceiveAmountRoundedDown.amount > 0 }, toggleWallet);
};
//# sourceMappingURL=use-convert-money-details.js.map