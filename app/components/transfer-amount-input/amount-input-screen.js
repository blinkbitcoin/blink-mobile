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
import * as React from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { APPROXIMATE_PREFIX } from "@app/config";
import { useDebouncedEffect } from "@app/hooks/use-debounce";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { numberPadReducer, NumberPadReducerActionType, } from "@app/components/amount-input-screen/number-pad-reducer";
import { greaterThan, lessThan, } from "@app/types/amounts";
import { AmountInputScreenUI } from "./amount-input-screen-ui";
export var ConvertInputType;
(function (ConvertInputType) {
    ConvertInputType["FROM"] = "fromInput";
    ConvertInputType["TO"] = "toInput";
    ConvertInputType["CURRENCY"] = "currencyInput";
})(ConvertInputType || (ConvertInputType = {}));
var formatNumberPadNumber = function (n) {
    var majorAmount = n.majorAmount, minorAmount = n.minorAmount, hasDecimal = n.hasDecimal;
    if (!majorAmount && !minorAmount && !hasDecimal)
        return "";
    var formattedMajor = Number(majorAmount).toLocaleString();
    return hasDecimal ? "".concat(formattedMajor, ".").concat(minorAmount) : formattedMajor;
};
var numberPadNumberToMoneyAmount = function (_a) {
    var numberPadNumber = _a.numberPadNumber, currency = _a.currency, currencyInfo = _a.currencyInfo;
    var majorAmount = numberPadNumber.majorAmount, minorAmount = numberPadNumber.minorAmount;
    var _b = currencyInfo[currency], minorUnitToMajorUnitOffset = _b.minorUnitToMajorUnitOffset, currencyCode = _b.currencyCode;
    var majorInMinor = Math.pow(10, minorUnitToMajorUnitOffset) * Number(majorAmount);
    var slicedMinor = minorAmount.slice(0, minorUnitToMajorUnitOffset);
    var missing = minorUnitToMajorUnitOffset - slicedMinor.length;
    var amount = majorInMinor + Number(minorAmount) * Math.pow(10, missing);
    return { amount: amount, currency: currency, currencyCode: currencyCode };
};
var moneyAmountToNumberPadReducerState = function (_a) {
    var moneyAmount = _a.moneyAmount, currencyInfo = _a.currencyInfo;
    var amountString = moneyAmount.amount.toString();
    var _b = currencyInfo[moneyAmount.currency], minorUnitToMajorUnitOffset = _b.minorUnitToMajorUnitOffset, showFractionDigits = _b.showFractionDigits;
    var numberPadNumber;
    if (amountString === "0") {
        numberPadNumber = { majorAmount: "", minorAmount: "", hasDecimal: false };
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
var snapshotKey = function (values) {
    var focusedValue = function (isFocused) { return (isFocused ? 1 : 0); };
    return [
        values.formattedAmount,
        values.fromInput.formattedAmount,
        values.toInput.formattedAmount,
        values.currencyInput.formattedAmount,
        values.fromInput.currency,
        values.toInput.currency,
        values.currencyInput.currency,
        focusedValue(values.fromInput.isFocused),
        focusedValue(values.toInput.isFocused),
        focusedValue(values.currencyInput.isFocused),
    ].join("|");
};
export var AmountInputScreen = function (_a) {
    var inputValues = _a.inputValues, onAmountChange = _a.onAmountChange, convertMoneyAmount = _a.convertMoneyAmount, maxAmount = _a.maxAmount, minAmount = _a.minAmount, onSetFormattedAmount = _a.onSetFormattedAmount, initialAmount = _a.initialAmount, focusedInput = _a.focusedInput, _b = _a.compact, compact = _b === void 0 ? false : _b, _c = _a.debounceMs, debounceMs = _c === void 0 ? 600 : _c, onTypingChange = _a.onTypingChange, onAfterRecalc = _a.onAfterRecalc, _d = _a.lockFormattingUntilBlur, lockFormattingUntilBlur = _d === void 0 ? false : _d;
    var _e = useDisplayCurrency(), currencyInfo = _e.currencyInfo, formatMoneyAmount = _e.formatMoneyAmount, zeroDisplayAmount = _e.zeroDisplayAmount;
    var LL = useI18nContext().LL;
    var lastValuesRef = useRef(null);
    var lastSnapshotRef = useRef(null);
    var skipNextRecalcRef = useRef(false);
    var focusedIdRef = useRef(null);
    var prevFocusSigRef = useRef(null);
    var _f = useReducer(numberPadReducer, moneyAmountToNumberPadReducerState({
        moneyAmount: zeroDisplayAmount,
        currencyInfo: currencyInfo,
    })), numberPadState = _f[0], dispatchNumberPadAction = _f[1];
    var freezeFormatRef = useRef(false);
    var typingRef = useRef(false);
    var _g = useState(false), typingState = _g[0], setTypingState = _g[1];
    var forceDebounceRef = useRef(false);
    var notifyTyping = useCallback(function (typing) {
        typingRef.current = typing;
        setTypingState(typing);
        if (onTypingChange)
            onTypingChange(typing, focusedIdRef.current);
    }, [onTypingChange]);
    var startTyping = useCallback(function () {
        if (!typingRef.current)
            notifyTyping(true);
        if (lockFormattingUntilBlur)
            freezeFormatRef.current = true;
    }, [notifyTyping, lockFormattingUntilBlur]);
    var handleKeyPress = useCallback(function (key) {
        startTyping();
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.HandleKeyPress,
            payload: { key: key },
        });
    }, [startTyping]);
    var setNumberPadAmount = useCallback(function (amount) {
        dispatchNumberPadAction({
            action: NumberPadReducerActionType.SetAmount,
            payload: moneyAmountToNumberPadReducerState({
                moneyAmount: amount,
                currencyInfo: currencyInfo,
            }),
        });
    }, [currencyInfo]);
    var createFocusStates = useCallback(function (focusedId) { return ({
        fromInput: { isFocused: focusedId === ConvertInputType.FROM },
        toInput: { isFocused: focusedId === ConvertInputType.TO },
        currencyInput: { isFocused: focusedId === ConvertInputType.CURRENCY },
    }); }, []);
    var convertToInputCurrencies = useCallback(function (primaryAmount, primaryCurrency) {
        var convertAmount = function (targetCurrency) {
            return targetCurrency === primaryCurrency
                ? primaryAmount
                : convertMoneyAmount(primaryAmount, targetCurrency);
        };
        return {
            fromAmount: convertAmount(inputValues.fromInput.amount.currency),
            toAmount: convertAmount(inputValues.toInput.amount.currency),
            currencyAmount: convertAmount(inputValues.currencyInput.amount.currency),
        };
    }, [convertMoneyAmount, inputValues]);
    useEffect(function () {
        if (initialAmount) {
            setNumberPadAmount(initialAmount);
            forceDebounceRef.current = true;
        }
    }, [initialAmount, setNumberPadAmount]);
    useEffect(function () {
        var _a, _b, _c, _d, _e, _f;
        if (!focusedInput)
            return;
        var focusSig = "".concat(focusedInput.id, "|").concat(focusedInput.amount.amount, "|").concat(focusedInput.amount.currency);
        if (prevFocusSigRef.current === focusSig) {
            return;
        }
        prevFocusSigRef.current = focusSig;
        skipNextRecalcRef.current = true;
        focusedIdRef.current = focusedInput.id;
        freezeFormatRef.current = false;
        var currentAmountFromNp = numberPadNumberToMoneyAmount({
            numberPadNumber: moneyAmountToNumberPadReducerState({
                moneyAmount: zeroDisplayAmount,
                currencyInfo: currencyInfo,
            }).numberPadNumber,
            currency: focusedInput.amount.currency,
            currencyInfo: currencyInfo,
        });
        forceDebounceRef.current =
            currentAmountFromNp.amount !== focusedInput.amount.amount ||
                currentAmountFromNp.currency !== focusedInput.amount.currency;
        setNumberPadAmount(focusedInput.amount);
        var npState = moneyAmountToNumberPadReducerState({
            moneyAmount: focusedInput.amount,
            currencyInfo: currencyInfo,
        });
        var formattedOnFocus = formatNumberPadNumber(npState.numberPadNumber);
        var focusStates = createFocusStates(focusedIdRef.current);
        var baseValues = lastValuesRef.current || inputValues;
        var stripApproximatePrefix = function (value) {
            if (!value)
                return value;
            return value.replace(new RegExp("^\\s*".concat(APPROXIMATE_PREFIX, "\\s*")), "");
        };
        var ensureApproximatePrefix = function (value) {
            if (!value)
                return value;
            if (value.trim().startsWith(APPROXIMATE_PREFIX))
                return value;
            return "".concat(APPROXIMATE_PREFIX, " ").concat(value);
        };
        var updatedValues = __assign(__assign({}, baseValues), { formattedAmount: formattedOnFocus, fromInput: __assign(__assign(__assign({}, baseValues.fromInput), focusStates.fromInput), { formattedAmount: focusedIdRef.current === ConvertInputType.FROM
                    ? (_a = stripApproximatePrefix(baseValues.fromInput.formattedAmount)) !== null && _a !== void 0 ? _a : ""
                    : (_b = ensureApproximatePrefix(baseValues.fromInput.formattedAmount)) !== null && _b !== void 0 ? _b : "" }), toInput: __assign(__assign(__assign({}, baseValues.toInput), focusStates.toInput), { formattedAmount: focusedIdRef.current === ConvertInputType.TO
                    ? (_c = stripApproximatePrefix(baseValues.toInput.formattedAmount)) !== null && _c !== void 0 ? _c : ""
                    : (_d = ensureApproximatePrefix(baseValues.toInput.formattedAmount)) !== null && _d !== void 0 ? _d : "" }), currencyInput: __assign(__assign(__assign({}, baseValues.currencyInput), focusStates.currencyInput), { formattedAmount: focusedIdRef.current === ConvertInputType.CURRENCY
                    ? (_e = stripApproximatePrefix(baseValues.currencyInput.formattedAmount)) !== null && _e !== void 0 ? _e : ""
                    : (_f = ensureApproximatePrefix(baseValues.currencyInput.formattedAmount)) !== null && _f !== void 0 ? _f : "" }) });
        var nextSnap = snapshotKey(updatedValues);
        if (nextSnap !== lastSnapshotRef.current) {
            onSetFormattedAmount(updatedValues);
            lastSnapshotRef.current = nextSnap;
            lastValuesRef.current = updatedValues;
        }
    }, [
        focusedInput,
        setNumberPadAmount,
        onSetFormattedAmount,
        currencyInfo,
        inputValues,
        createFocusStates,
        zeroDisplayAmount,
    ]);
    useEffect(function () {
        if (!typingRef.current)
            return;
        var numberPadNumber = numberPadState.numberPadNumber;
        var formattedAmount = formatNumberPadNumber(numberPadNumber);
        var baseValues = lastValuesRef.current || inputValues;
        var payload = __assign(__assign({}, baseValues), { formattedAmount: formattedAmount });
        var nextSnap = snapshotKey(payload);
        if (nextSnap !== lastSnapshotRef.current) {
            onSetFormattedAmount(payload);
            lastSnapshotRef.current = nextSnap;
            lastValuesRef.current = payload;
        }
    }, [numberPadState, inputValues, onSetFormattedAmount]);
    useEffect(function () {
        if (skipNextRecalcRef.current) {
            skipNextRecalcRef.current = false;
        }
    }, [focusedInput]);
    var debounceEnabled = Boolean(inputValues) &&
        !skipNextRecalcRef.current &&
        (typingState || forceDebounceRef.current);
    useDebouncedEffect(function () {
        var _a, _b;
        var numberPadNumber = numberPadState.numberPadNumber;
        var digitsEmpty = !numberPadNumber.majorAmount &&
            !numberPadNumber.minorAmount &&
            !numberPadNumber.hasDecimal;
        if (digitsEmpty && !lastValuesRef.current)
            return;
        var pickWhenEmpty = inputValues.fromInput.amount.amount > 0
            ? inputValues.fromInput.amount
            : inputValues.toInput.amount.amount > 0
                ? inputValues.toInput.amount
                : inputValues.currencyInput.amount;
        var primaryCurrency = digitsEmpty
            ? pickWhenEmpty.currency
            : numberPadState.currency;
        var primaryAmount = digitsEmpty
            ? pickWhenEmpty
            : numberPadNumberToMoneyAmount({
                numberPadNumber: numberPadNumber,
                currency: primaryCurrency,
                currencyInfo: currencyInfo,
            });
        var primaryNpState = moneyAmountToNumberPadReducerState({
            moneyAmount: primaryAmount,
            currencyInfo: currencyInfo,
        });
        var formattedFromPrimary = formatNumberPadNumber(primaryNpState.numberPadNumber);
        var _c = convertToInputCurrencies(primaryAmount, primaryCurrency), fromAmount = _c.fromAmount, toAmount = _c.toAmount, currencyAmount = _c.currencyAmount;
        var formatAmount = function (amount, isApproximate) {
            if (isApproximate === void 0) { isApproximate = false; }
            return formatMoneyAmount({ moneyAmount: amount, isApproximate: isApproximate });
        };
        var formattedForParent = freezeFormatRef.current
            ? (_b = (_a = lastValuesRef.current) === null || _a === void 0 ? void 0 : _a.formattedAmount) !== null && _b !== void 0 ? _b : formatNumberPadNumber(numberPadState.numberPadNumber)
            : formattedFromPrimary;
        var getFormattedAmount = function (amount, isApproximate) {
            if (isApproximate === void 0) { isApproximate = false; }
            if (digitsEmpty || primaryAmount.amount === 0)
                return "";
            return formatAmount(amount, isApproximate);
        };
        var approxFrom = inputValues.fromInput.amount.currency !== primaryCurrency;
        var approxTo = inputValues.toInput.amount.currency !== primaryCurrency;
        var approxCurrency = inputValues.currencyInput.amount.currency !== primaryCurrency;
        var payload = {
            formattedAmount: digitsEmpty ? "" : formattedForParent,
            fromInput: {
                id: ConvertInputType.FROM,
                currency: inputValues.fromInput.amount.currency,
                formattedAmount: getFormattedAmount(fromAmount, approxFrom),
                isFocused: focusedIdRef.current === ConvertInputType.FROM,
                amount: fromAmount,
            },
            toInput: {
                id: ConvertInputType.TO,
                currency: inputValues.toInput.amount.currency,
                formattedAmount: getFormattedAmount(toAmount, approxTo),
                isFocused: focusedIdRef.current === ConvertInputType.TO,
                amount: toAmount,
            },
            currencyInput: {
                id: ConvertInputType.CURRENCY,
                currency: inputValues.currencyInput.amount.currency,
                formattedAmount: getFormattedAmount(currencyAmount, approxCurrency),
                isFocused: focusedIdRef.current === ConvertInputType.CURRENCY,
                amount: currencyAmount,
            },
        };
        var nextSnap = snapshotKey(payload);
        if (nextSnap !== lastSnapshotRef.current) {
            onSetFormattedAmount(payload);
            lastSnapshotRef.current = nextSnap;
            lastValuesRef.current = payload;
        }
        onAmountChange(primaryAmount);
        notifyTyping(false);
        forceDebounceRef.current = false;
        onAfterRecalc === null || onAfterRecalc === void 0 ? void 0 : onAfterRecalc();
    }, debounceMs, [
        numberPadState,
        currencyInfo,
        inputValues,
        formatMoneyAmount,
        onSetFormattedAmount,
        onAmountChange,
        convertToInputCurrencies,
        notifyTyping,
        onAfterRecalc,
    ], { enabled: debounceEnabled, leading: false, trailing: true });
    var getErrorMessage = function () {
        if (typingRef.current)
            return null;
        var currentAmount = numberPadNumberToMoneyAmount({
            numberPadNumber: numberPadState.numberPadNumber,
            currency: numberPadState.currency,
            currencyInfo: currencyInfo,
        });
        if (maxAmount) {
            var maxInPrimaryCurrency = convertMoneyAmount(maxAmount, currentAmount.currency);
            var currentInMaxCurrency = convertMoneyAmount(currentAmount, maxInPrimaryCurrency.currency);
            if (greaterThan({ value: currentInMaxCurrency, greaterThan: maxInPrimaryCurrency })) {
                return LL.AmountInputScreen.maxAmountExceeded({
                    maxAmount: formatMoneyAmount({ moneyAmount: maxInPrimaryCurrency }),
                });
            }
        }
        if (minAmount && currentAmount.amount) {
            var minInPrimaryCurrency = convertMoneyAmount(minAmount, currentAmount.currency);
            var currentInMinCurrency = convertMoneyAmount(currentAmount, minInPrimaryCurrency.currency);
            if (lessThan({ value: currentInMinCurrency, lessThan: minInPrimaryCurrency })) {
                return LL.AmountInputScreen.minAmountNotMet({
                    minAmount: formatMoneyAmount({ moneyAmount: minInPrimaryCurrency }),
                });
            }
        }
        return null;
    };
    var errorMessage = getErrorMessage();
    return (<AmountInputScreenUI errorMessage={errorMessage || ""} onKeyPress={handleKeyPress} compact={compact}/>);
};
//# sourceMappingURL=amount-input-screen.js.map