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
export var DestinationState = {
    Entering: "entering",
    Pasting: "pasting",
    Validating: "validating",
    Valid: "valid",
    RequiresUsernameConfirmation: "requires-destination-confirmation",
    Invalid: "invalid",
    PhoneInvalid: "phone-invalid",
    PhoneNotAllowed: "phone-not-allowed",
};
export var SendBitcoinActions = {
    SetUnparsedDestination: "set-unparsed-destination",
    SetUnparsedPastedDestination: "set-unparsed-pasted-destination",
    SetValidating: "set-validating",
    SetValid: "set-valid",
    SetInvalid: "set-invalid",
    SetRequiresUsernameConfirmation: "set-requires-destination-confirmation",
    SetConfirmed: "set-confirmed",
    SetPhoneInvalid: "set-phone-invalid",
    SetPhoneNotAllowed: "set-phone-not-allowed",
};
export var sendBitcoinDestinationReducer = function (state, action) {
    var _a, _b, _c, _d;
    switch (action.type) {
        case SendBitcoinActions.SetUnparsedPastedDestination:
            return {
                unparsedDestination: action.payload.unparsedDestination,
                destinationState: DestinationState.Pasting,
            };
        case SendBitcoinActions.SetUnparsedDestination:
            return {
                unparsedDestination: action.payload.unparsedDestination,
                destinationState: DestinationState.Entering,
            };
        case SendBitcoinActions.SetValidating:
            return __assign(__assign({}, state), { destinationState: DestinationState.Validating });
        case SendBitcoinActions.SetValid:
            return state.unparsedDestination === ((_a = action.payload) === null || _a === void 0 ? void 0 : _a.unparsedDestination)
                ? {
                    unparsedDestination: state.unparsedDestination,
                    destinationState: DestinationState.Valid,
                    destination: action.payload.validDestination,
                }
                : state;
        case SendBitcoinActions.SetInvalid:
            if (state.destinationState === DestinationState.Validating) {
                return state.unparsedDestination === ((_b = action.payload) === null || _b === void 0 ? void 0 : _b.unparsedDestination)
                    ? {
                        unparsedDestination: state.unparsedDestination,
                        destinationState: DestinationState.Invalid,
                        invalidDestination: action.payload.invalidDestination,
                    }
                    : state;
            }
            throw new Error("Invalid state transition");
        case SendBitcoinActions.SetRequiresUsernameConfirmation:
            if (state.destinationState === DestinationState.Validating) {
                return state.unparsedDestination === ((_c = action.payload) === null || _c === void 0 ? void 0 : _c.unparsedDestination)
                    ? {
                        unparsedDestination: state.unparsedDestination,
                        destinationState: DestinationState.RequiresUsernameConfirmation,
                        destination: action.payload.validDestination,
                        confirmationUsernameType: action.payload.confirmationUsernameType,
                    }
                    : state;
            }
            throw new Error("Invalid state transition");
        case SendBitcoinActions.SetConfirmed:
            if (state.destinationState === DestinationState.RequiresUsernameConfirmation) {
                return state.unparsedDestination === ((_d = action.payload) === null || _d === void 0 ? void 0 : _d.unparsedDestination)
                    ? {
                        unparsedDestination: state.unparsedDestination,
                        destinationState: DestinationState.Valid,
                        destination: state.destination,
                        confirmationUsernameType: state.confirmationUsernameType,
                    }
                    : state;
            }
            throw new Error("Invalid state transition");
        case SendBitcoinActions.SetPhoneInvalid:
            return __assign(__assign({}, state), { destinationState: DestinationState.PhoneInvalid });
        case SendBitcoinActions.SetPhoneNotAllowed:
            return __assign(__assign({}, state), { destinationState: DestinationState.PhoneNotAllowed });
        default:
            return state;
    }
};
//# sourceMappingURL=send-bitcoin-reducer.js.map