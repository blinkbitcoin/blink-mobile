var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { useCallback, useMemo } from "react";
import { gql } from "@apollo/client";
import { APPROXIMATE_PREFIX } from "@app/config";
import { useCurrencyListQuery, WalletCurrency } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { DisplayCurrency, lessThan, toBtcMoneyAmount, toUsdMoneyAmount, } from "@app/types/amounts";
import { usePriceConversion } from "./use-price-conversion";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query displayCurrency {\n    me {\n      id\n      defaultAccount {\n        id\n        displayCurrency\n      }\n    }\n  }\n\n  query currencyList {\n    currencyList {\n      __typename\n      id\n      flag\n      name\n      symbol\n      fractionDigits\n    }\n  }\n"], ["\n  query displayCurrency {\n    me {\n      id\n      defaultAccount {\n        id\n        displayCurrency\n      }\n    }\n  }\n\n  query currencyList {\n    currencyList {\n      __typename\n      id\n      flag\n      name\n      symbol\n      fractionDigits\n    }\n  }\n"])));
var usdDisplayCurrency = {
    symbol: "$",
    id: "USD",
    fractionDigits: 2,
};
var defaultDisplayCurrency = usdDisplayCurrency;
var formatCurrencyHelper = function (_a) {
    var amountInMajorUnits = _a.amountInMajorUnits, symbol = _a.symbol, isApproximate = _a.isApproximate, fractionDigits = _a.fractionDigits, _b = _a.withSign, withSign = _b === void 0 ? true : _b, currencyCode = _a.currencyCode;
    var isNegative = Number(amountInMajorUnits) < 0;
    var decimalPlaces = fractionDigits;
    var amountStr = Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        // FIXME this workaround of using .format and not .formatNumber is
        // because hermes haven't fully implemented Intl.NumberFormat yet
    }).format(Math.abs(Number(amountInMajorUnits)));
    return "".concat(isApproximate ? "".concat(APPROXIMATE_PREFIX, " ") : "").concat(isNegative && withSign ? "-" : "").concat(symbol).concat(amountStr).concat(currencyCode ? " ".concat(currencyCode) : "");
};
var displayCurrencyHasSignificantMinorUnits = function (_a) {
    var convertMoneyAmount = _a.convertMoneyAmount, amountInMajorUnitOrSatsToMoneyAmount = _a.amountInMajorUnitOrSatsToMoneyAmount;
    if (!convertMoneyAmount) {
        return true;
    }
    var oneMajorUnitOfDisplayCurrency = amountInMajorUnitOrSatsToMoneyAmount(1, DisplayCurrency);
    var oneUsdCentInDisplayCurrency = convertMoneyAmount(toUsdMoneyAmount(1), DisplayCurrency);
    return lessThan({
        value: oneUsdCentInDisplayCurrency,
        lessThan: oneMajorUnitOfDisplayCurrency,
    });
};
export var useDisplayCurrency = function () {
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var dataCurrencyList = useCurrencyListQuery({ skip: !isAuthed }).data;
    var _a = usePriceConversion(), convertMoneyAmount = _a.convertMoneyAmount, displayCurrency = _a.displayCurrency, toDisplayMoneyAmount = _a.toDisplayMoneyAmount;
    var displayCurrencyDictionary = useMemo(function () {
        var currencyList = (dataCurrencyList === null || dataCurrencyList === void 0 ? void 0 : dataCurrencyList.currencyList) || [];
        return currencyList.reduce(function (acc, currency) {
            acc[currency.id] = currency;
            return acc;
        }, {});
    }, [dataCurrencyList === null || dataCurrencyList === void 0 ? void 0 : dataCurrencyList.currencyList]);
    var displayCurrencyInfo = displayCurrencyDictionary[displayCurrency] || defaultDisplayCurrency;
    var moneyAmountToMajorUnitOrSats = useCallback(function (moneyAmount) {
        switch (moneyAmount.currency) {
            case WalletCurrency.Btc:
                return moneyAmount.amount;
            case WalletCurrency.Usd:
                return moneyAmount.amount / 100;
            case DisplayCurrency:
                return moneyAmount.amount / Math.pow(10, displayCurrencyInfo.fractionDigits);
        }
    }, [displayCurrencyInfo]);
    var amountInMajorUnitOrSatsToMoneyAmount = useCallback(function (amount, currency) {
        switch (currency) {
            case WalletCurrency.Btc:
                return toBtcMoneyAmount(Math.round(amount));
            case WalletCurrency.Usd:
                return toUsdMoneyAmount(Math.round(amount * 100));
            case DisplayCurrency:
                return toDisplayMoneyAmount(Math.round(amount * Math.pow(10, displayCurrencyInfo.fractionDigits)));
        }
    }, [displayCurrencyInfo, toDisplayMoneyAmount]);
    var displayCurrencyShouldDisplayDecimals = displayCurrencyHasSignificantMinorUnits({
        convertMoneyAmount: convertMoneyAmount,
        amountInMajorUnitOrSatsToMoneyAmount: amountInMajorUnitOrSatsToMoneyAmount,
    });
    var currencyInfo = useMemo(function () {
        var _a;
        return _a = {},
            _a[WalletCurrency.Usd] = {
                symbol: usdDisplayCurrency.symbol,
                minorUnitToMajorUnitOffset: usdDisplayCurrency.fractionDigits,
                showFractionDigits: true,
                currencyCode: usdDisplayCurrency.id,
            },
            _a[WalletCurrency.Btc] = {
                symbol: "",
                minorUnitToMajorUnitOffset: 0,
                showFractionDigits: false,
                currencyCode: "SAT",
            },
            _a[DisplayCurrency] = {
                symbol: displayCurrencyInfo.symbol,
                minorUnitToMajorUnitOffset: displayCurrencyInfo.fractionDigits,
                showFractionDigits: displayCurrencyShouldDisplayDecimals,
                currencyCode: displayCurrencyInfo.id,
            },
            _a;
    }, [displayCurrencyInfo, displayCurrencyShouldDisplayDecimals]);
    var formatCurrency = useCallback(function (_a) {
        var amountInMajorUnits = _a.amountInMajorUnits, currency = _a.currency, withSign = _a.withSign, currencyCode = _a.currencyCode;
        var currencyInfo = displayCurrencyDictionary[currency] || {
            symbol: currency,
            fractionDigits: 2,
        };
        return formatCurrencyHelper({
            amountInMajorUnits: amountInMajorUnits,
            symbol: currencyInfo.symbol,
            fractionDigits: currencyInfo.fractionDigits,
            withSign: withSign,
            currencyCode: currencyCode,
        });
    }, [displayCurrencyDictionary]);
    var formatMoneyAmount = useCallback(function (_a) {
        var moneyAmount = _a.moneyAmount, _b = _a.noSymbol, noSymbol = _b === void 0 ? false : _b, _c = _a.noSuffix, noSuffix = _c === void 0 ? false : _c, _d = _a.isApproximate, isApproximate = _d === void 0 ? false : _d;
        var amount = moneyAmountToMajorUnitOrSats(moneyAmount);
        if (Number.isNaN(amount)) {
            return "";
        }
        var _e = currencyInfo[moneyAmount.currency], symbol = _e.symbol, minorUnitToMajorUnitOffset = _e.minorUnitToMajorUnitOffset, showFractionDigits = _e.showFractionDigits, currencyCode = _e.currencyCode;
        if (moneyAmount.currency === DisplayCurrency &&
            currencyCode !== moneyAmount.currencyCode) {
            // TODO: we should display the correct currency but this requires `showFractionDigits` to come from the backend
            return LL.common.currencySyncIssue();
        }
        return formatCurrencyHelper({
            amountInMajorUnits: amount,
            isApproximate: isApproximate,
            symbol: noSymbol ? "" : symbol,
            fractionDigits: showFractionDigits ? minorUnitToMajorUnitOffset : 0,
            currencyCode: moneyAmount.currency === WalletCurrency.Btc && !noSuffix
                ? currencyCode
                : undefined,
        });
    }, [currencyInfo, moneyAmountToMajorUnitOrSats, LL]);
    var getSecondaryAmountIfCurrencyIsDifferent = useCallback(function (_a) {
        var primaryAmount = _a.primaryAmount, displayAmount = _a.displayAmount, walletAmount = _a.walletAmount;
        // if the display currency is the same as the wallet amount currency, we don't need to show the secondary amount (example: USD display currency with USD wallet amount)
        if (walletAmount.currency === displayAmount.currencyCode) {
            return undefined;
        }
        if (primaryAmount.currency === DisplayCurrency) {
            return walletAmount;
        }
        return displayAmount;
    }, []);
    var formatDisplayAndWalletAmount = useCallback(function (_a) {
        var primaryAmount = _a.primaryAmount, displayAmount = _a.displayAmount, walletAmount = _a.walletAmount;
        // if the primary amount is not provided, we use the display amount as the primary amount by default
        var primaryAmountWithDefault = primaryAmount || displayAmount;
        var secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
            primaryAmount: primaryAmountWithDefault,
            displayAmount: displayAmount,
            walletAmount: walletAmount,
        });
        if (secondaryAmount) {
            return "".concat(formatMoneyAmount({
                moneyAmount: primaryAmountWithDefault,
            }), " (").concat(formatMoneyAmount({
                moneyAmount: secondaryAmount,
            }), ")");
        }
        return formatMoneyAmount({ moneyAmount: primaryAmountWithDefault });
    }, [getSecondaryAmountIfCurrencyIsDifferent, formatMoneyAmount]);
    var moneyAmountToDisplayCurrencyString = useCallback(function (_a) {
        var moneyAmount = _a.moneyAmount, isApproximate = _a.isApproximate;
        if (!convertMoneyAmount) {
            return undefined;
        }
        return formatMoneyAmount({
            moneyAmount: convertMoneyAmount(moneyAmount, DisplayCurrency),
            isApproximate: isApproximate,
        });
    }, [convertMoneyAmount, formatMoneyAmount]);
    var getCurrencySymbol = useCallback(function (_a) {
        var currency = _a.currency;
        var currencyInfo = displayCurrencyDictionary[currency] || {
            symbol: currency,
            fractionDigits: 2,
        };
        return currencyInfo.symbol;
    }, [displayCurrencyDictionary]);
    return {
        fractionDigits: displayCurrencyInfo.fractionDigits,
        fiatSymbol: displayCurrencyInfo.symbol,
        displayCurrency: displayCurrency,
        formatMoneyAmount: formatMoneyAmount,
        getSecondaryAmountIfCurrencyIsDifferent: getSecondaryAmountIfCurrencyIsDifferent,
        formatDisplayAndWalletAmount: formatDisplayAndWalletAmount,
        moneyAmountToDisplayCurrencyString: moneyAmountToDisplayCurrencyString,
        // TODO: remove export. we should only accept MoneyAmount instead of number as input
        // for exported functions for consistency
        displayCurrencyShouldDisplayDecimals: displayCurrencyShouldDisplayDecimals,
        currencyInfo: currencyInfo,
        moneyAmountToMajorUnitOrSats: moneyAmountToMajorUnitOrSats,
        zeroDisplayAmount: toDisplayMoneyAmount(0),
        formatCurrency: formatCurrency,
        getCurrencySymbol: getCurrencySymbol,
    };
};
var templateObject_1;
//# sourceMappingURL=use-display-currency.js.map