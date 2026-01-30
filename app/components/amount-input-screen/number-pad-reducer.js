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
export var NumberPadReducerActionType = {
    SetAmount: "SetAmount",
    HandleKeyPress: "HandleKeyPress",
    ClearAmount: "ClearAmount",
    HandlePaste: "HandlePaste",
};
export var Key = {
    Backspace: "⌫",
    0: "0",
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    Decimal: ".",
};
export var numberPadReducer = function (state, action) {
    var _a;
    var _b = state.numberPadNumber, majorAmount = _b.majorAmount, minorAmount = _b.minorAmount, hasDecimal = _b.hasDecimal, numberOfDecimalsAllowed = state.numberOfDecimalsAllowed;
    switch (action.action) {
        case NumberPadReducerActionType.SetAmount:
            return action.payload;
        case NumberPadReducerActionType.HandlePaste: {
            var num = action.payload.keys;
            var formatted = num % 1 === 0 ? num.toString() : num.toFixed(numberOfDecimalsAllowed);
            var splitByDecimal = formatted.split(".");
            return __assign(__assign({}, state), { numberPadNumber: {
                    majorAmount: splitByDecimal[0],
                    hasDecimal: splitByDecimal.length > 1,
                    minorAmount: (_a = splitByDecimal[1]) !== null && _a !== void 0 ? _a : "",
                } });
        }
        case NumberPadReducerActionType.HandleKeyPress:
            if (action.payload.key === Key.Backspace) {
                if (minorAmount.length > 0) {
                    return __assign(__assign({}, state), { numberPadNumber: {
                            majorAmount: majorAmount,
                            hasDecimal: hasDecimal,
                            minorAmount: minorAmount.slice(0, -1),
                        } });
                }
                if (hasDecimal) {
                    return __assign(__assign({}, state), { numberPadNumber: {
                            majorAmount: majorAmount,
                            hasDecimal: false,
                            minorAmount: minorAmount,
                        } });
                }
                return __assign(__assign({}, state), { numberPadNumber: {
                        majorAmount: majorAmount.slice(0, -1),
                        hasDecimal: hasDecimal,
                        minorAmount: minorAmount,
                    } });
            }
            if (action.payload.key === Key.Decimal) {
                if (numberOfDecimalsAllowed > 0) {
                    return __assign(__assign({}, state), { numberPadNumber: {
                            majorAmount: majorAmount,
                            minorAmount: minorAmount,
                            hasDecimal: true,
                        } });
                }
                return state;
            }
            if (hasDecimal && minorAmount.length < numberOfDecimalsAllowed) {
                return __assign(__assign({}, state), { numberPadNumber: {
                        majorAmount: majorAmount,
                        hasDecimal: hasDecimal,
                        minorAmount: minorAmount + action.payload.key,
                    } });
            }
            if (hasDecimal && minorAmount.length >= numberOfDecimalsAllowed) {
                return state;
            }
            return __assign(__assign({}, state), { numberPadNumber: {
                    majorAmount: majorAmount + action.payload.key,
                    minorAmount: minorAmount,
                    hasDecimal: hasDecimal,
                } });
        case NumberPadReducerActionType.ClearAmount:
            return __assign(__assign({}, state), { numberPadNumber: {
                    majorAmount: "",
                    minorAmount: "",
                    hasDecimal: false,
                } });
        default:
            return state;
    }
};
//# sourceMappingURL=number-pad-reducer.js.map