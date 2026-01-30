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
import { useCallback } from "react";
import { ConvertInputType } from "@app/components/transfer-amount-input";
import { findBtcSuffixIndex } from "@app/screens/conversion-flow/btc-format";
export var useConversionOverlayFocus = function (_a) {
    var uiLocked = _a.uiLocked, lockFormattingInputId = _a.lockFormattingInputId, setLockFormattingInputId = _a.setLockFormattingInputId, setIsTyping = _a.setIsTyping, inputFormattedValues = _a.inputFormattedValues, inputValues = _a.inputValues, renderValue = _a.renderValue, fromInputRef = _a.fromInputRef, toInputRef = _a.toInputRef, setFocusedInputValues = _a.setFocusedInputValues;
    var handleInputPress = useCallback(function (id) {
        var _a, _b, _c, _d, _e;
        if (uiLocked)
            return;
        if (lockFormattingInputId && lockFormattingInputId !== id) {
            setLockFormattingInputId(null);
        }
        setIsTyping(false);
        var ref = id === ConvertInputType.FROM ? fromInputRef : toInputRef;
        var value = (_a = renderValue(id)) !== null && _a !== void 0 ? _a : "";
        var pos = findBtcSuffixIndex(value);
        var inputToFocus = id === ConvertInputType.FROM
            ? (_b = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.fromInput) !== null && _b !== void 0 ? _b : inputValues.fromInput
            : (_c = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.toInput) !== null && _c !== void 0 ? _c : inputValues.toInput;
        setFocusedInputValues(__assign({}, inputToFocus));
        (_d = ref.current) === null || _d === void 0 ? void 0 : _d.focus();
        (_e = ref.current) === null || _e === void 0 ? void 0 : _e.setNativeProps({ selection: { start: pos, end: pos } });
    }, [
        uiLocked,
        lockFormattingInputId,
        setLockFormattingInputId,
        setIsTyping,
        inputFormattedValues,
        inputValues,
        renderValue,
        fromInputRef,
        toInputRef,
        setFocusedInputValues,
    ]);
    var focusPhysically = useCallback(function (id) {
        var _a, _b, _c;
        var ref = id === ConvertInputType.FROM ? fromInputRef : toInputRef;
        var value = (_a = renderValue(id)) !== null && _a !== void 0 ? _a : "";
        var pos = findBtcSuffixIndex(value);
        (_b = ref.current) === null || _b === void 0 ? void 0 : _b.focus();
        (_c = ref.current) === null || _c === void 0 ? void 0 : _c.setNativeProps({ selection: { start: pos, end: pos } });
    }, [renderValue, fromInputRef, toInputRef]);
    return { handleInputPress: handleInputPress, focusPhysically: focusPhysically };
};
//# sourceMappingURL=use-conversion-overlay-focus.js.map