import { useMemo } from "react";
import { useRealtimePriceQuery, WalletCurrency } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { createToDisplayAmount, DisplayCurrency, moneyAmountIsCurrencyType, } from "@app/types/amounts";
import crashlytics from "@react-native-firebase/crashlytics";
export var SATS_PER_BTC = 100000000;
var usdDisplayCurrency = {
    symbol: "$",
    id: "USD",
    fractionDigits: 2,
};
var defaultDisplayCurrency = usdDisplayCurrency;
export var usePriceConversion = function () {
    var _a, _b, _c, _d, _e;
    var isAuthed = useIsAuthed();
    var data = useRealtimePriceQuery({ skip: !isAuthed }).data;
    var displayCurrency = ((_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.realtimePrice) === null || _c === void 0 ? void 0 : _c.denominatorCurrency) ||
        defaultDisplayCurrency.id;
    var displayCurrencyPerSat = NaN;
    var displayCurrencyPerCent = NaN;
    var realtimePrice = (_e = (_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.realtimePrice;
    if (realtimePrice) {
        displayCurrencyPerSat =
            realtimePrice.btcSatPrice.base / Math.pow(10, realtimePrice.btcSatPrice.offset);
        displayCurrencyPerCent =
            realtimePrice.usdCentPrice.base / Math.pow(10, realtimePrice.usdCentPrice.offset);
    }
    var priceOfCurrencyInCurrency = useMemo(function () {
        if (!displayCurrencyPerSat || !displayCurrencyPerCent) {
            return undefined;
        }
        // has units of denomiatedInCurrency/currency
        return function (currency, inCurrency) {
            var _a, _b, _c, _d;
            var priceOfCurrencyInCurrency = (_a = {},
                _a[WalletCurrency.Btc] = (_b = {},
                    _b[DisplayCurrency] = displayCurrencyPerSat,
                    _b[WalletCurrency.Usd] = displayCurrencyPerSat * (1 / displayCurrencyPerCent),
                    _b[WalletCurrency.Btc] = 1,
                    _b),
                _a[WalletCurrency.Usd] = (_c = {},
                    _c[DisplayCurrency] = displayCurrencyPerCent,
                    _c[WalletCurrency.Btc] = displayCurrencyPerCent * (1 / displayCurrencyPerSat),
                    _c[WalletCurrency.Usd] = 1,
                    _c),
                _a[DisplayCurrency] = (_d = {},
                    _d[WalletCurrency.Btc] = 1 / displayCurrencyPerSat,
                    _d[WalletCurrency.Usd] = 1 / displayCurrencyPerCent,
                    _d[DisplayCurrency] = 1,
                    _d),
                _a);
            return priceOfCurrencyInCurrency[currency][inCurrency];
        };
    }, [displayCurrencyPerSat, displayCurrencyPerCent]);
    var converters = useMemo(function () {
        if (!priceOfCurrencyInCurrency) {
            return undefined;
        }
        var convertWithRounding = function (moneyAmount, toCurrency, roundingFn) {
            // If the money amount is already the correct currency, return it
            if (moneyAmountIsCurrencyType(moneyAmount, toCurrency)) {
                return moneyAmount;
            }
            var amount = roundingFn(moneyAmount.amount * priceOfCurrencyInCurrency(moneyAmount.currency, toCurrency));
            if (moneyAmountIsCurrencyType(moneyAmount, DisplayCurrency) &&
                moneyAmount.currencyCode !== displayCurrency) {
                amount = NaN;
                crashlytics().recordError(new Error("Price conversion is out of sync with display currency. Money amount: ".concat(moneyAmount.currencyCode, ", display currency: ").concat(displayCurrency)));
            }
            return {
                amount: amount,
                currency: toCurrency,
                currencyCode: toCurrency === DisplayCurrency ? displayCurrency : toCurrency,
            };
        };
        var convertMoneyAmount = function (moneyAmount, toCurrency) { return convertWithRounding(moneyAmount, toCurrency, Math.round); };
        var convertMoneyAmountWithRounding = function (moneyAmount, toCurrency, roundingFn) { return convertWithRounding(moneyAmount, toCurrency, roundingFn); };
        return { convertMoneyAmount: convertMoneyAmount, convertMoneyAmountWithRounding: convertMoneyAmountWithRounding };
    }, [priceOfCurrencyInCurrency, displayCurrency]);
    return {
        convertMoneyAmount: converters === null || converters === void 0 ? void 0 : converters.convertMoneyAmount,
        convertMoneyAmountWithRounding: converters === null || converters === void 0 ? void 0 : converters.convertMoneyAmountWithRounding,
        displayCurrency: displayCurrency,
        toDisplayMoneyAmount: createToDisplayAmount(displayCurrency),
        usdPerSat: priceOfCurrencyInCurrency
            ? (priceOfCurrencyInCurrency(WalletCurrency.Btc, WalletCurrency.Usd) / 100).toFixed(8)
            : null,
    };
};
//# sourceMappingURL=use-price-conversion.js.map