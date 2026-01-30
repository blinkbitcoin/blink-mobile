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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { ConversionConfirmationScreen } from "@app/screens/conversion-flow";
import { HomeAuthedDocument, WalletCurrency } from "@app/graphql/generated";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { ContextForScreen } from "../helper";
var conversionQueryMock = jest.fn(function () { return ({
    data: {
        me: {
            id: "user-id",
            defaultAccount: {
                id: "account-id",
                wallets: [
                    {
                        id: "btc-wallet-id",
                        walletCurrency: "BTC",
                        balance: 100000,
                        __typename: "BTCWallet",
                    },
                    {
                        id: "usd-wallet-id",
                        walletCurrency: "USD",
                        balance: 5000,
                        __typename: "UsdWallet",
                    },
                ],
                __typename: "ConsumerAccount",
            },
            __typename: "User",
        },
    },
}); });
var intraLedgerMutationMock = jest.fn(function () {
    return Promise.resolve({
        data: {
            intraLedgerPaymentSend: {
                status: "SUCCESS",
                errors: [],
            },
        },
    });
});
var intraLedgerUsdMutationMock = jest.fn(function () {
    return Promise.resolve({
        data: {
            intraLedgerUsdPaymentSend: {
                status: "SUCCESS",
                errors: [],
            },
        },
    });
});
jest.mock("@app/graphql/generated", function () {
    var actual = jest.requireActual("@app/graphql/generated");
    return __assign(__assign({}, actual), { useConversionScreenQuery: function () { return conversionQueryMock(); }, useIntraLedgerPaymentSendMutation: function () { return [
            intraLedgerMutationMock,
            { loading: false },
        ]; }, useIntraLedgerUsdPaymentSendMutation: function () { return [
            intraLedgerUsdMutationMock,
            { loading: false },
        ]; } });
});
var priceConversionMock = jest.fn(function () { return ({
    convertMoneyAmount: function (moneyAmount, toCurrency) { return ({
        amount: moneyAmount.amount,
        currency: toCurrency,
        currencyCode: toCurrency,
    }); },
    displayCurrency: "USD",
    toDisplayMoneyAmount: function () { return ({ amount: 1, currency: "USD" }); },
    usdPerSat: "0.00000001",
}); });
jest.mock("@app/hooks", function () {
    var actual = jest.requireActual("@app/hooks");
    return __assign(__assign({}, actual), { usePriceConversion: function () { return priceConversionMock(); }, SATS_PER_BTC: 100000000 });
});
var displayCurrencyMock = jest.fn(function () { return ({
    displayCurrency: "USD",
    formatMoneyAmount: function (_a) {
        var moneyAmount = _a.moneyAmount;
        return "$".concat(moneyAmount.amount);
    },
    moneyAmountToDisplayCurrencyString: function (_a) {
        var moneyAmount = _a.moneyAmount;
        return "$".concat(moneyAmount.amount);
    },
}); });
jest.mock("@app/hooks/use-display-currency", function () { return ({
    useDisplayCurrency: function () { return displayCurrencyMock(); },
}); });
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: jest.fn() })); });
jest.mock("react-native-haptic-feedback", function () { return ({
    trigger: jest.fn(),
}); });
jest.mock("@react-native-firebase/crashlytics", function () { return function () { return ({
    recordError: jest.fn(),
}); }; });
jest.mock("@app/utils/toast", function () { return ({
    toastShow: jest.fn(),
}); });
jest.mock("@app/utils/analytics", function () { return ({
    logConversionAttempt: jest.fn(),
    logConversionResult: jest.fn(),
}); });
jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", function () {
    var MockGaloySliderButton = function (_a) {
        var onSwipe = _a.onSwipe, initialText = _a.initialText;
        return (<TouchableOpacity onPress={onSwipe}>
      <Text>{initialText}</Text>
    </TouchableOpacity>);
    };
    return { __esModule: true, default: MockGaloySliderButton };
});
describe("conversion-confirmation-screen", function () {
    var LL;
    var dispatchMock = jest.fn();
    beforeAll(function () {
        loadLocale("en");
    });
    beforeEach(function () {
        LL = i18nObject("en");
        jest.clearAllMocks();
        useNavigation.mockReturnValue({ dispatch: dispatchMock });
    });
    it("renders BTC to USD texts", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route, transferText, infoText;
        return __generator(this, function (_a) {
            route = {
                key: "conversionConfirmation",
                name: "conversionConfirmation",
                params: {
                    fromWalletCurrency: WalletCurrency.Btc,
                    moneyAmount: {
                        amount: 10000,
                        currency: WalletCurrency.Btc,
                        currencyCode: WalletCurrency.Btc,
                    },
                },
            };
            render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
            transferText = LL.ConversionConfirmationScreen.transferButtonText({
                fromWallet: LL.common.bitcoin(),
                toWallet: LL.common.dollar(),
            });
            infoText = LL.ConversionConfirmationScreen.infoDollar();
            expect(conversionQueryMock).toHaveBeenCalled();
            expect(priceConversionMock).toHaveBeenCalled();
            expect(displayCurrencyMock).toHaveBeenCalled();
            expect(screen.getByText(transferText)).toBeTruthy();
            expect(screen.getByText(infoText)).toBeTruthy();
            return [2 /*return*/];
        });
    }); });
    it("renders USD to BTC texts", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route, transferText, infoText;
        return __generator(this, function (_a) {
            route = {
                key: "conversionConfirmation",
                name: "conversionConfirmation",
                params: {
                    fromWalletCurrency: WalletCurrency.Usd,
                    moneyAmount: {
                        amount: 5000,
                        currency: WalletCurrency.Usd,
                        currencyCode: WalletCurrency.Usd,
                    },
                },
            };
            render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
            transferText = LL.ConversionConfirmationScreen.transferButtonText({
                fromWallet: LL.common.dollar(),
                toWallet: LL.common.bitcoin(),
            });
            infoText = LL.ConversionConfirmationScreen.infoBitcoin();
            expect(screen.getByText(transferText)).toBeTruthy();
            expect(screen.getByText(infoText)).toBeTruthy();
            return [2 /*return*/];
        });
    }); });
    it("shows conversion rate", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route;
        return __generator(this, function (_a) {
            route = {
                key: "conversionConfirmation",
                name: "conversionConfirmation",
                params: {
                    fromWalletCurrency: WalletCurrency.Btc,
                    moneyAmount: {
                        amount: 10000,
                        currency: WalletCurrency.Btc,
                        currencyCode: WalletCurrency.Btc,
                    },
                },
            };
            render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
            expect(screen.getByText("1 BTC = $100000000")).toBeTruthy();
            return [2 /*return*/];
        });
    }); });
    it("shows from and to amounts for BTC to USD", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route;
        return __generator(this, function (_a) {
            route = {
                key: "conversionConfirmation",
                name: "conversionConfirmation",
                params: {
                    fromWalletCurrency: WalletCurrency.Btc,
                    moneyAmount: {
                        amount: 10000,
                        currency: WalletCurrency.Btc,
                        currencyCode: WalletCurrency.Btc,
                    },
                },
            };
            render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
            expect(screen.getAllByText("$10000").length).toBeGreaterThanOrEqual(2);
            return [2 /*return*/];
        });
    }); });
    it("sends BTC conversion on swipe", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    route = {
                        key: "conversionConfirmation",
                        name: "conversionConfirmation",
                        params: {
                            fromWalletCurrency: WalletCurrency.Btc,
                            moneyAmount: {
                                amount: 10000,
                                currency: WalletCurrency.Btc,
                                currencyCode: WalletCurrency.Btc,
                            },
                        },
                    };
                    render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
                    fireEvent.press(screen.getByText(LL.ConversionConfirmationScreen.transferButtonText({
                        fromWallet: LL.common.bitcoin(),
                        toWallet: LL.common.dollar(),
                    })));
                    return [4 /*yield*/, waitFor(function () {
                            expect(intraLedgerMutationMock).toHaveBeenCalledWith({
                                variables: {
                                    input: {
                                        walletId: "btc-wallet-id",
                                        recipientWalletId: "usd-wallet-id",
                                        amount: 10000,
                                    },
                                },
                                refetchQueries: [HomeAuthedDocument],
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(dispatchMock).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("sends USD conversion on swipe", function () { return __awaiter(void 0, void 0, void 0, function () {
        var route;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    route = {
                        key: "conversionConfirmation",
                        name: "conversionConfirmation",
                        params: {
                            fromWalletCurrency: WalletCurrency.Usd,
                            moneyAmount: {
                                amount: 5000,
                                currency: WalletCurrency.Usd,
                                currencyCode: WalletCurrency.Usd,
                            },
                        },
                    };
                    render(<ContextForScreen>
        <ConversionConfirmationScreen route={route}/>
      </ContextForScreen>);
                    fireEvent.press(screen.getByText(LL.ConversionConfirmationScreen.transferButtonText({
                        fromWallet: LL.common.dollar(),
                        toWallet: LL.common.bitcoin(),
                    })));
                    return [4 /*yield*/, waitFor(function () {
                            expect(intraLedgerUsdMutationMock).toHaveBeenCalledWith({
                                variables: {
                                    input: {
                                        walletId: "usd-wallet-id",
                                        recipientWalletId: "btc-wallet-id",
                                        amount: 5000,
                                    },
                                },
                                refetchQueries: [HomeAuthedDocument],
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(dispatchMock).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=conversion-confirmation.spec.js.map