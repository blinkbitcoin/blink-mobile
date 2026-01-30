import { useCallback } from "react";
import { ConvertInputType } from "@app/components/transfer-amount-input";
import { WalletCurrency } from "@app/graphql/generated";
import { findBtcSuffixIndex, formatBtcWithSuffix, } from "@app/screens/conversion-flow/btc-format";
export var useConversionFormatting = function (_a) {
    var inputValues = _a.inputValues, inputFormattedValues = _a.inputFormattedValues, isTyping = _a.isTyping, typingInputId = _a.typingInputId, lockFormattingInputId = _a.lockFormattingInputId, displayCurrency = _a.displayCurrency, getCurrencySymbol = _a.getCurrencySymbol;
    var getInputField = useCallback(function (id) {
        if (id === ConvertInputType.FROM)
            return inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.fromInput;
        if (id === ConvertInputType.TO)
            return inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.toInput;
        return inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.currencyInput;
    }, [inputFormattedValues]);
    var fieldFormatted = useCallback(function (id) { var _a; return ((_a = getInputField(id)) === null || _a === void 0 ? void 0 : _a.formattedAmount) || ""; }, [getInputField]);
    var getCurrency = useCallback(function (id) {
        if (id === ConvertInputType.FROM)
            return inputValues.fromInput.currency;
        if (id === ConvertInputType.TO)
            return inputValues.toInput.currency;
        return displayCurrency;
    }, [inputValues, displayCurrency]);
    var typedValue = useCallback(function (id) {
        var _a;
        var digits = (_a = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.formattedAmount) !== null && _a !== void 0 ? _a : "";
        if (!digits)
            return "";
        var currency = getCurrency(id);
        if (currency === WalletCurrency.Btc)
            return formatBtcWithSuffix(digits);
        return "".concat(getCurrencySymbol({ currency: currency })).concat(digits);
    }, [inputFormattedValues, getCurrency, getCurrencySymbol]);
    var renderValue = useCallback(function (id) {
        return (isTyping && typingInputId === id) || lockFormattingInputId === id
            ? typedValue(id)
            : fieldFormatted(id);
    }, [isTyping, typingInputId, lockFormattingInputId, typedValue, fieldFormatted]);
    var caretSelectionFor = useCallback(function (id) {
        var _a;
        var value = (_a = renderValue(id)) !== null && _a !== void 0 ? _a : "";
        var pos = findBtcSuffixIndex(value);
        return { start: pos, end: pos };
    }, [renderValue]);
    return { renderValue: renderValue, caretSelectionFor: caretSelectionFor };
};
//# sourceMappingURL=use-conversion-formatting.js.map