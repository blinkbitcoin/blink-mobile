import * as React from "react";
import { useCallback, useEffect, useReducer } from "react";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { DisplayCurrency, greaterThan, lessThan, } from "@app/types/amounts";
import { AmountInputScreenUI } from "./amount-input-screen-ui";
import { numberPadReducer, NumberPadReducerActionType, } from "./number-pad-reducer";
var formatNumberPadNumber = function (numberPadNumber) {
    var majorAmount = numberPadNumber.majorAmount, minorAmount = numberPadNumber.minorAmount, hasDecimal = numberPadNumber.hasDecimal;
    if (!majorAmount && !minorAmount && !hasDecimal) {
        return "";
    }
    var formattedMajorAmount = Number(majorAmount).toLocaleString();
    if (hasDecimal) {
        return "".concat(formattedMajorAmount, ".").concat(minorAmount);
    }
    return formattedMajorAmount;
};
var numberPadNumberToMoneyAmount = function (_a) {
    var numberPadNumber = _a.numberPadNumber, currency = _a.currency, currencyInfo = _a.currencyInfo;
    var majorAmount = numberPadNumber.majorAmount, minorAmount = numberPadNumber.minorAmount;
    var _b = currencyInfo[currency], minorUnitToMajorUnitOffset = _b.minorUnitToMajorUnitOffset, currencyCode = _b.currencyCode;
    var majorAmountInMinorUnit = Math.pow(10, minorUnitToMajorUnitOffset) * Number(majorAmount);
    // if minorUnitToMajorUnitOffset is 2, slice 234354 to 23
    var slicedMinorAmount = minorAmount.slice(0, minorUnitToMajorUnitOffset);
    // if minorAmount is 4 and minorUnitToMajorUnitOffset is 2, then missing zeros is 1
    var minorAmountMissingZeros = minorUnitToMajorUnitOffset - slicedMinorAmount.length;
    var amount = majorAmountInMinorUnit + Number(minorAmount) * Math.pow(10, minorAmountMissingZeros);
    return {
        amount: amount,
        currency: currency,
        currencyCode: currencyCode,
    };
};
var moneyAmountToNumberPadReducerState = function (_a) {
    var moneyAmount = _a.moneyAmount, currencyInfo = _a.currencyInfo;
    var amountString = moneyAmount.amount.toString();
    var _b = currencyInfo[moneyAmount.currency], minorUnitToMajorUnitOffset = _b.minorUnitToMajorUnitOffset, showFractionDigits = _b.showFractionDigits;
    var numberPadNumber;
    if (amountString === "0") {
        numberPadNumber = {
            majorAmount: "",
            minorAmount: "",
            hasDecimal: false,
        };
    }
    else if (amountString.length <= minorUnitToMajorUnitOffset) {
        numberPadNumber = {
            majorAmount: "0",
            minorAmount: showFractionDigits
                ? amountString.padStart(minorUnitToMajorUnitOffset, "0")
                : "",
            hasDecimal: showFractionDigits,
        };
    }
    else {
        numberPadNumber = {
            majorAmount: amountString.slice(0, amountString.length - minorUnitToMajorUnitOffset),
            minorAmount: showFractionDigits
                ? amountString.slice(amountString.length - minorUnitToMajorUnitOffset)
                : "",
            hasDecimal: showFractionDigits && minorUnitToMajorUnitOffset > 0,
        };
    }
    return {
        numberPadNumber: numberPadNumber,
        numberOfDecimalsAllowed: showFractionDigits ? minorUnitToMajorUnitOffset : 0,
        currency: moneyAmount.currency,
    };
};
export var AmountInputScreen = function (_a) {
    var goBack = _a.goBack, initialAmount = _a.initialAmount, setAmount = _a.setAmount, walletCurrency = _a.walletCurrency, convertMoneyAmount = _a.convertMoneyAmount, maxAmount = _a.maxAmount, minAmount = _a.minAmount, _b = _a.compact, compact = _b === void 0 ? false : _b;
    var _c = useDisplayCurrency(), currencyInfo = _c.currencyInfo, getSecondaryAmountIfCurrencyIsDifferent = _c.getSecondaryAmountIfCurrencyIsDifferent, formatMoneyAmount = _c.formatMoneyAmount, zeroDisplayAmount = _c.zeroDisplayAmount;
    var LL = useI18nContext().LL;
    var _d = useReducer(numberPadReducer, moneyAmountToNumberPadReducerState({
        moneyAmount: initialAmount || zeroDisplayAmount,
        currencyInfo: currencyInfo,
    })), numberPadState = _d[0], dispatchNumberPadAction = _d[1];
    var newPrimaryAmount = numberPadNumberToMoneyAmount({
        numberPadNumber: numberPadState.numberPadNumber,
        currency: numberPadState.currency,
        currencyInfo: currencyInfo,
    });
    var secondaryNewAmount = getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: newPrimaryAmount,
        walletAmount: convertMoneyAmount(newPrimaryAmount, walletCurrency),
        displayAmount: convertMoneyAmount(newPrimaryAmount, DisplayCurrency),
    });
    var onKeyPress = function (key) {
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.HandleKeyPress,
            payload: {
                key: key,
            },
        });
    };
    var onPaste = function (keys) {
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.HandlePaste,
            payload: {
                keys: keys,
            },
        });
    };
    var onClear = function () {
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.ClearAmount,
        });
    };
    var setNumberPadAmount = useCallback(function (amount) {
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.SetAmount,
            payload: moneyAmountToNumberPadReducerState({
                moneyAmount: amount,
                currencyInfo: currencyInfo,
            }),
        });
    }, [currencyInfo]);
    var onToggleCurrency = secondaryNewAmount &&
        (function () {
            setNumberPadAmount(secondaryNewAmount);
        });
    useEffect(function () {
        if (initialAmount) {
            setNumberPadAmount(initialAmount);
        }
    }, [initialAmount, setNumberPadAmount]);
    var errorMessage = "";
    var maxAmountInPrimaryCurrency = maxAmount && convertMoneyAmount(maxAmount, newPrimaryAmount.currency);
    var minAmountInPrimaryCurrency = minAmount && convertMoneyAmount(minAmount, newPrimaryAmount.currency);
    if (maxAmountInPrimaryCurrency &&
        greaterThan({
            value: convertMoneyAmount(newPrimaryAmount, maxAmountInPrimaryCurrency.currency),
            greaterThan: maxAmountInPrimaryCurrency,
        })) {
        errorMessage = LL.AmountInputScreen.maxAmountExceeded({
            maxAmount: formatMoneyAmount({ moneyAmount: maxAmountInPrimaryCurrency }),
        });
    }
    else if (minAmountInPrimaryCurrency &&
        newPrimaryAmount.amount &&
        lessThan({
            value: convertMoneyAmount(newPrimaryAmount, minAmountInPrimaryCurrency.currency),
            lessThan: minAmountInPrimaryCurrency,
        })) {
        errorMessage = LL.AmountInputScreen.minAmountNotMet({
            minAmount: formatMoneyAmount({ moneyAmount: minAmountInPrimaryCurrency }),
        });
    }
    var primaryCurrencyInfo = currencyInfo[newPrimaryAmount.currency];
    var secondaryCurrencyInfo = secondaryNewAmount && currencyInfo[secondaryNewAmount.currency];
    return (<AmountInputScreenUI primaryCurrencyCode={primaryCurrencyInfo.currencyCode} primaryCurrencyFormattedAmount={formatNumberPadNumber(numberPadState.numberPadNumber)} primaryCurrencySymbol={primaryCurrencyInfo.symbol} secondaryCurrencyCode={secondaryCurrencyInfo === null || secondaryCurrencyInfo === void 0 ? void 0 : secondaryCurrencyInfo.currencyCode} secondaryCurrencyFormattedAmount={secondaryNewAmount &&
            formatMoneyAmount({
                moneyAmount: secondaryNewAmount,
                noSuffix: true,
                noSymbol: true,
            })} secondaryCurrencySymbol={secondaryCurrencyInfo === null || secondaryCurrencyInfo === void 0 ? void 0 : secondaryCurrencyInfo.symbol} errorMessage={errorMessage} onKeyPress={onKeyPress} onPaste={onPaste} onClearAmount={onClear} onToggleCurrency={onToggleCurrency} setAmountDisabled={Boolean(errorMessage)} onSetAmountPress={setAmount && (function () { return setAmount(newPrimaryAmount); })} goBack={goBack} compact={compact}/>);
};
//# sourceMappingURL=amount-input-screen.js.map