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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import React from "react";
import { Text, } from "react-native";
import { it } from "@jest/globals";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import { MockedProvider } from "@apollo/client/testing";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { ThemeProvider } from "@rn-vui/themed";
import { ConversionDetailsScreen } from "@app/screens/conversion-flow/conversion-details-screen";
import { WalletCurrency, ConversionScreenDocument, RealtimePriceDocument, DisplayCurrencyDocument, CurrencyListDocument, } from "@app/graphql/generated";
import { APPROXIMATE_PREFIX } from "@app/config";
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context";
import TypesafeI18n from "@app/i18n/i18n-react";
import theme from "@app/rne-theme/theme";
import { createCache } from "@app/graphql/cache";
import { DisplayCurrency as DisplayCurrencyType } from "@app/types/amounts";
var mockNavigate = jest.fn();
var originalConsoleError = console.error;
var consoleErrorSpy = null;
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: function () { return ({
        navigate: mockNavigate,
    }); } })); });
jest.mock("@app/components/atomic/currency-pill", function () { return ({
    CurrencyPill: function (props) { var _a; return <Text>{(_a = props.label) !== null && _a !== void 0 ? _a : ""}</Text>; },
    useEqualPillWidth: function () { return ({
        widthStyle: { minWidth: 140 },
        onPillLayout: function () { return jest.fn(); },
    }); },
}); });
jest.mock("@app/components/atomic/currency-pill/use-equal-pill-width", function () { return ({
    useEqualPillWidth: function () { return ({
        widthStyle: { minWidth: 140 },
        onPillLayout: function () { return jest.fn(); },
    }); },
}); });
var Stack = createStackNavigator();
var BTC_SAT_PRICE_BASE = 2200000000;
var BTC_SAT_PRICE_OFFSET = 12;
var USD_CENT_PRICE_BASE = 100000000;
var USD_CENT_PRICE_OFFSET = 6;
var calculateExpectedUsdFromSats = function (sats) {
    var displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET);
    var displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET);
    var usdCents = Math.round(sats * displayCurrencyPerSat * (1 / displayCurrencyPerCent));
    return usdCents;
};
var calculateExpectedSatsFromUsd = function (usdCents) {
    var displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET);
    var displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET);
    var sats = Math.round(usdCents * displayCurrencyPerCent * (1 / displayCurrencyPerSat));
    return sats;
};
var formatNumber = function (amount, fractionDigits) {
    return Intl.NumberFormat("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(amount);
};
var formatSats = function (sats) {
    return "".concat(formatNumber(sats, 0), " SAT");
};
var formatUsdCents = function (usdCents) {
    return "$".concat(formatNumber(usdCents / 100, 2));
};
var withApprox = function (value, isApprox) {
    return isApprox ? "".concat(APPROXIMATE_PREFIX, " ").concat(value) : value;
};
var getDisplaySymbol = function (displayCurrency) {
    if (displayCurrency === "EUR")
        return "€";
    return "$";
};
var displayCurrencyFractionDigits = {
    USD: 2,
    EUR: 2,
};
var getDisplayCurrencyInfo = function (displayCurrency) {
    var _a;
    var fractionDigits = (_a = displayCurrencyFractionDigits[displayCurrency]) !== null && _a !== void 0 ? _a : 2;
    var oneMajorUnitInMinor = Math.pow(10, fractionDigits);
    var showFractionDigits = displayCurrencyPerCent < oneMajorUnitInMinor;
    return {
        fractionDigits: fractionDigits,
        showFractionDigits: showFractionDigits,
        symbol: getDisplaySymbol(displayCurrency),
    };
};
var formatDisplayMinor = function (minorUnits, displayCurrency) {
    var _a = getDisplayCurrencyInfo(displayCurrency), fractionDigits = _a.fractionDigits, showFractionDigits = _a.showFractionDigits, symbol = _a.symbol;
    var amountInMajor = minorUnits / Math.pow(10, fractionDigits);
    var digits = showFractionDigits ? fractionDigits : 0;
    return "".concat(symbol).concat(formatNumber(amountInMajor, digits));
};
var createGraphQLMocks = function (options) {
    var btcBalance = options.btcBalance, usdBalance = options.usdBalance, _a = options.displayCurrency, displayCurrency = _a === void 0 ? "USD" : _a;
    var conversionScreenMock = {
        request: { query: ConversionScreenDocument },
        result: {
            data: {
                __typename: "Query",
                me: {
                    __typename: "User",
                    id: "user-id",
                    defaultAccount: {
                        __typename: "ConsumerAccount",
                        id: "account-id",
                        wallets: [
                            {
                                __typename: "BTCWallet",
                                id: "btc-wallet-id",
                                balance: btcBalance,
                                walletCurrency: WalletCurrency.Btc,
                            },
                            {
                                __typename: "UsdWallet",
                                id: "usd-wallet-id",
                                balance: usdBalance,
                                walletCurrency: WalletCurrency.Usd,
                            },
                        ],
                    },
                },
            },
        },
    };
    var realtimePriceMock = {
        request: { query: RealtimePriceDocument },
        result: {
            data: {
                __typename: "Query",
                me: {
                    __typename: "User",
                    id: "user-id",
                    defaultAccount: {
                        __typename: "ConsumerAccount",
                        id: "account-id",
                        realtimePrice: {
                            __typename: "RealtimePrice",
                            id: "price-id",
                            timestamp: Date.now(),
                            denominatorCurrency: displayCurrency,
                            btcSatPrice: {
                                __typename: "PriceOfOneSatInMinorUnit",
                                base: BTC_SAT_PRICE_BASE,
                                offset: BTC_SAT_PRICE_OFFSET,
                            },
                            usdCentPrice: {
                                __typename: "PriceOfOneUsdCentInMinorUnit",
                                base: USD_CENT_PRICE_BASE,
                                offset: USD_CENT_PRICE_OFFSET,
                            },
                        },
                    },
                },
            },
        },
    };
    var displayCurrencyMock = {
        request: { query: DisplayCurrencyDocument },
        result: {
            data: {
                __typename: "Query",
                me: {
                    __typename: "User",
                    id: "user-id",
                    defaultAccount: {
                        __typename: "ConsumerAccount",
                        id: "account-id",
                        displayCurrency: displayCurrency,
                    },
                },
            },
        },
    };
    var currencyListMock = {
        request: { query: CurrencyListDocument },
        result: {
            data: {
                __typename: "Query",
                currencyList: [
                    {
                        __typename: "Currency",
                        id: "USD",
                        flag: "",
                        name: "US Dollar",
                        symbol: "$",
                        fractionDigits: 2,
                    },
                    {
                        __typename: "Currency",
                        id: "EUR",
                        flag: "",
                        name: "Euro",
                        symbol: "€",
                        fractionDigits: 2,
                    },
                ],
            },
        },
    };
    return [
        conversionScreenMock,
        realtimePriceMock,
        displayCurrencyMock,
        currencyListMock,
        conversionScreenMock,
        realtimePriceMock,
        displayCurrencyMock,
        currencyListMock,
        conversionScreenMock,
        realtimePriceMock,
        displayCurrencyMock,
        currencyListMock,
    ];
};
var createEmptyMocks = function () {
    var baseMocks = [
        {
            request: { query: ConversionScreenDocument },
            result: { data: { __typename: "Query", me: null } },
        },
        {
            request: { query: RealtimePriceDocument },
            result: { data: { __typename: "Query", me: null } },
        },
        {
            request: { query: DisplayCurrencyDocument },
            result: { data: { __typename: "Query", me: null } },
        },
        {
            request: { query: CurrencyListDocument },
            result: { data: { __typename: "Query", currencyList: [] } },
        },
    ];
    return __spreadArray(__spreadArray(__spreadArray([], baseMocks, true), baseMocks, true), baseMocks, true);
};
var createTestWrapper = function (mocks) {
    var TestWrapper = function (_a) {
        var children = _a.children;
        return (<ThemeProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Test">
            {function () { return (<MockedProvider mocks={mocks} cache={createCache()} addTypename={true}>
                <TypesafeI18n locale="en">
                  <IsAuthedContextProvider value={true}>
                    {children}
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </MockedProvider>); }}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>);
    };
    return TestWrapper;
};
var pressKey = function (getByTestId, key) {
    var keyButton = getByTestId("Key ".concat(key));
    fireEvent.press(keyButton);
};
var pressKeys = function (getByTestId, keys) {
    keys.forEach(function (key) { return pressKey(getByTestId, key); });
};
var swapFocusedField = function (current) {
    return current === "from" ? "to" : current === "to" ? "from" : current;
};
var computeFocusedField = function (actions) {
    var focused = null;
    for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
        var action = actions_1[_i];
        if (action.type === "focus")
            focused = action.field;
        if (action.type === "type")
            focused = action.field;
        if (action.type === "typeDigits")
            focused = action.field;
        if (action.type === "clear" && action.field)
            focused = action.field;
        if (action.type === "percent")
            focused = "from";
        if (action.type === "toggle")
            focused = swapFocusedField(focused);
        if (action.type === "multiToggle") {
            for (var i = 0; i < action.count; i += 1) {
                focused = swapFocusedField(focused);
            }
        }
    }
    return focused;
};
var digitsForCurrency = function (currency, displayCurrency) {
    if (currency === WalletCurrency.Btc)
        return ["1", "0", "0", "0", "0", "0"];
    if (currency === WalletCurrency.Usd)
        return ["0", ".", "0", "1"];
    var showFractionDigits = getDisplayCurrencyInfo(displayCurrency).showFractionDigits;
    return showFractionDigits ? ["0", ".", "0", "1"] : ["1"];
};
var amountFromDigits = function (currency, digits, displayCurrency) {
    var raw = digits.join("");
    if (currency === WalletCurrency.Btc)
        return Number(raw.replace(".", ""));
    var fractionDigits = currency === WalletCurrency.Usd
        ? 2
        : getDisplayCurrencyInfo(displayCurrency).fractionDigits;
    if (!raw.includes(".")) {
        return Number(raw) * Math.pow(10, fractionDigits);
    }
    var _a = raw.split("."), major = _a[0], _b = _a[1], minor = _b === void 0 ? "" : _b;
    var paddedMinor = (minor + "0".repeat(fractionDigits)).slice(0, fractionDigits);
    return Number(major || "0") * Math.pow(10, fractionDigits) + Number(paddedMinor);
};
var displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET);
var displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET);
var convertAmount = function (amount, fromCurrency, toCurrency) {
    var _a, _b, _c, _d;
    var priceOfCurrencyInCurrency = (_a = {},
        _a[WalletCurrency.Btc] = (_b = {},
            _b[DisplayCurrencyType] = displayCurrencyPerSat,
            _b[WalletCurrency.Usd] = displayCurrencyPerSat * (1 / displayCurrencyPerCent),
            _b[WalletCurrency.Btc] = 1,
            _b),
        _a[WalletCurrency.Usd] = (_c = {},
            _c[DisplayCurrencyType] = displayCurrencyPerCent,
            _c[WalletCurrency.Btc] = displayCurrencyPerCent * (1 / displayCurrencyPerSat),
            _c[WalletCurrency.Usd] = 1,
            _c),
        _a[DisplayCurrencyType] = (_d = {},
            _d[WalletCurrency.Btc] = 1 / displayCurrencyPerSat,
            _d[WalletCurrency.Usd] = 1 / displayCurrencyPerCent,
            _d[DisplayCurrencyType] = 1,
            _d),
        _a);
    return Math.round(priceOfCurrencyInCurrency[fromCurrency][toCurrency] * amount);
};
var formatCurrencyValue = function (currency, amount, displayCurrency) {
    if (currency === WalletCurrency.Btc)
        return formatSats(amount);
    if (currency === WalletCurrency.Usd)
        return formatUsdCents(amount);
    return formatDisplayMinor(amount, displayCurrency);
};
var getInitialFromCurrency = function (btcBalance, usdBalance) {
    if (btcBalance === 0 && usdBalance > 0)
        return WalletCurrency.Usd;
    return WalletCurrency.Btc;
};
var getFromInput = function (getByPlaceholderText, fromCurrency) { return getByPlaceholderText(fromCurrency === WalletCurrency.Btc ? "0 SAT" : "$0"); };
var getToInput = function (getByPlaceholderText, toCurrency) { return getByPlaceholderText(toCurrency === WalletCurrency.Btc ? "0 SAT" : "$0"); };
var getCurrencyInput = function (getByPlaceholderText, displayCurrency) { return getByPlaceholderText("".concat(getDisplaySymbol(displayCurrency), "0")); };
var assertConversionValues = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var fromAmount, toAmount, fromValue, toValue, fromInput, toInput, displayAmount, displayValue_1, currencyInput_1;
    var getByPlaceholderText = _b.getByPlaceholderText, primary = _b.primary, fromCurrency = _b.fromCurrency, toCurrency = _b.toCurrency, displayCurrency = _b.displayCurrency, focusedField = _b.focusedField;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                fromAmount = convertAmount(primary.amount, primary.currency, fromCurrency);
                toAmount = convertAmount(primary.amount, primary.currency, toCurrency);
                fromValue = withApprox(formatCurrencyValue(fromCurrency, fromAmount, displayCurrency), focusedField !== "from");
                toValue = withApprox(formatCurrencyValue(toCurrency, toAmount, displayCurrency), focusedField !== "to");
                fromInput = getFromInput(getByPlaceholderText, fromCurrency);
                toInput = getToInput(getByPlaceholderText, toCurrency);
                return [4 /*yield*/, waitFor(function () {
                        expect(fromInput.props.value).toBe(fromValue);
                        expect(toInput.props.value).toBe(toValue);
                    })];
            case 1:
                _c.sent();
                if (!(displayCurrency !== "USD")) return [3 /*break*/, 3];
                displayAmount = convertAmount(primary.amount, primary.currency, DisplayCurrencyType);
                displayValue_1 = withApprox(formatCurrencyValue(DisplayCurrencyType, displayAmount, displayCurrency), focusedField !== "currency");
                currencyInput_1 = getCurrencyInput(getByPlaceholderText, displayCurrency);
                return [4 /*yield*/, waitFor(function () {
                        expect(currencyInput_1.props.value).toBe(displayValue_1);
                    })];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); };
beforeAll(function () {
    consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var text = String(message);
        if (text.includes("not wrapped in act"))
            return;
        originalConsoleError.apply(void 0, __spreadArray([message], args, false));
    });
});
afterAll(function () {
    if (!consoleErrorSpy)
        return;
    consoleErrorSpy.mockRestore();
    consoleErrorSpy = null;
});
beforeEach(function () {
    jest.clearAllMocks();
});
describe("Initial render with both wallets having balance", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    it("renders with BTC as from wallet when both have balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    expect(getByPlaceholderText("0 SAT")).toBeTruthy();
                    expect(getByPlaceholderText("$0")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("toggle button is enabled", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, toggleButton;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    toggleButton = getByTestId("wallet-toggle-button");
                    expect((_a = toggleButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("next button is disabled when no amount entered", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, nextButton;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("next-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    nextButton = getByTestId("next-button");
                    expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    it("percentage buttons are rendered", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    expect(getByTestId("convert-50%")).toBeTruthy();
                    expect(getByTestId("convert-75%")).toBeTruthy();
                    expect(getByTestId("convert-100%")).toBeTruthy();
                    expect(getByTestId("convert-25%")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Initial render based on wallet balance", function () {
    it("starts with BTC as from when only BTC has balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(createGraphQLMocks({
                        btcBalance: 100000,
                        usdBalance: 0,
                    }));
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    expect(getByPlaceholderText("0 SAT")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("starts with USD as from when only USD has balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(createGraphQLMocks({
                        btcBalance: 0,
                        usdBalance: 50000,
                    }));
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    expect(getByPlaceholderText("$0")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Toggle without amount - Critical bug test", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("swaps placeholders correctly after toggle", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText, toggleButton;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    expect(getByPlaceholderText("0 SAT")).toBeTruthy();
                    expect(getByPlaceholderText("$0")).toBeTruthy();
                    toggleButton = getByTestId("wallet-toggle-button");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(toggleButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(200);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            expect(function () { return getByPlaceholderText("$0"); }).not.toThrow();
                            expect(function () { return getByPlaceholderText("0 SAT"); }).not.toThrow();
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("toggle button remains enabled after toggle without amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, toggleButton;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    toggleButton = getByTestId("wallet-toggle-button");
                    expect((_a = toggleButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(toggleButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(200);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var button = getByTestId("wallet-toggle-button");
                            expect((_a = button.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("next button remains disabled after toggle without amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, nextButton, toggleButton;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("next-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    nextButton = getByTestId("next-button");
                    expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(true);
                    toggleButton = getByTestId("wallet-toggle-button");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(toggleButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(200);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var button = getByTestId("next-button");
                            expect((_a = button.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(true);
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles multiple consecutive toggles without crashing", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, toggleButton, i;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    toggleButton = getByTestId("wallet-toggle-button");
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < 3)) return [3 /*break*/, 6];
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(toggleButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(200);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    i += 1;
                    return [3 /*break*/, 2];
                case 6:
                    expect((_a = getByTestId("next-button").props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Keyboard input and conversion verification", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("keyboard keys are rendered and pressable", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("Key 1")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    expect(getByTestId("Key 2")).toBeTruthy();
                    expect(getByTestId("Key 3")).toBeTruthy();
                    expect(getByTestId("Key 4")).toBeTruthy();
                    expect(getByTestId("Key 5")).toBeTruthy();
                    expect(getByTestId("Key 6")).toBeTruthy();
                    expect(getByTestId("Key 7")).toBeTruthy();
                    expect(getByTestId("Key 8")).toBeTruthy();
                    expect(getByTestId("Key 9")).toBeTruthy();
                    expect(getByTestId("Key 0")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("entering amount via keyboard enables next button after debounce", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("Key 1")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                pressKeys(getByTestId, ["1", "0", "0", "0", "0", "0"]);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var nextButton = getByTestId("next-button");
                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        }, { timeout: 3000 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("converts sats to USD when typing in BTC input", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText, btcInput, usdInput, expectedUsdCents;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("Key 1")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    btcInput = getByPlaceholderText("0 SAT");
                    usdInput = getByPlaceholderText("$0");
                    act(function () {
                        fireEvent(btcInput, "focus");
                    });
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                pressKeys(getByTestId, ["1", "0", "0", "0", "0", "0"]);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    expectedUsdCents = calculateExpectedUsdFromSats(100000);
                    return [4 /*yield*/, waitFor(function () {
                            expect(btcInput.props.value).toBe(formatSats(100000));
                            expect(usdInput.props.value).toBe(withApprox(formatUsdCents(expectedUsdCents), true));
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Toggle then enter amount - Original bug scenario", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("toggle without amount, then enter amount - conversion should work", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText, toggleButton, btcInput, expectedUsdCents, usdInput;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(100);
                    });
                    toggleButton = getByTestId("wallet-toggle-button");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(toggleButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(200);
                    });
                    btcInput = getByPlaceholderText("0 SAT");
                    act(function () {
                        fireEvent(btcInput, "focus");
                    });
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                pressKeys(getByTestId, ["1", "0", "0", "0", "0", "0"]);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    expectedUsdCents = calculateExpectedUsdFromSats(100000);
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var nextButton = getByTestId("next-button");
                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        }, { timeout: 3000 })];
                case 4:
                    _b.sent();
                    usdInput = getByPlaceholderText("$0");
                    expect(btcInput.props.value).toBe(formatSats(100000));
                    expect(usdInput.props.value).toBe(withApprox(formatUsdCents(expectedUsdCents), true));
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("USD input converts to SAT", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 0,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("converts USD to sats when typing in USD input", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, _a, getByTestId, getByPlaceholderText, usdInput, btcInput, expectedSats;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("Key 1")).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    usdInput = getByPlaceholderText("$0");
                    btcInput = getByPlaceholderText("0 SAT");
                    act(function () {
                        fireEvent(usdInput, "focus");
                    });
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                pressKeys(getByTestId, ["0", ".", "0", "1"]);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    expectedSats = calculateExpectedSatsFromUsd(1);
                    return [4 /*yield*/, waitFor(function () {
                            expect(usdInput.props.value).toBe(formatUsdCents(1));
                            expect(btcInput.props.value).toBe(withApprox(formatSats(expectedSats), true));
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Percentage selector functionality", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("pressing 100% sets the full balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, fullBalanceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("convert-100%")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    fullBalanceButton = getByTestId("convert-100%");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(fullBalanceButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var nextButton = getByTestId("next-button");
                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        }, { timeout: 3000 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("pressing 50% sets half the balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, halfBalanceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("convert-50%")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    halfBalanceButton = getByTestId("convert-50%");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(halfBalanceButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var nextButton = getByTestId("next-button");
                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        }, { timeout: 3000 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Navigation", function () {
    var buildMocks = function () {
        return createGraphQLMocks({
            btcBalance: 100000,
            usdBalance: 50000,
        });
    };
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("navigates to confirmation screen with correct params when next is pressed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, getByTestId, fullBalanceButton, nextButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Wrapper = createTestWrapper(buildMocks());
                    getByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).getByTestId;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("convert-100%")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    fullBalanceButton = getByTestId("convert-100%");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(fullBalanceButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    act(function () {
                        jest.advanceTimersByTime(1500);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            var _a;
                            var nextButton = getByTestId("next-button");
                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                        }, { timeout: 3000 })];
                case 3:
                    _a.sent();
                    nextButton = getByTestId("next-button");
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(nextButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    _a.sent();
                    expect(mockNavigate).toHaveBeenCalledWith("conversionConfirmation", expect.objectContaining({
                        fromWalletCurrency: WalletCurrency.Btc,
                        moneyAmount: expect.objectContaining({
                            currency: expect.any(String),
                            amount: expect.any(Number),
                        }),
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Empty state handling", function () {
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("renders nothing when wallet data is missing", function () { return __awaiter(void 0, void 0, void 0, function () {
        var Wrapper, queryByTestId;
        return __generator(this, function (_a) {
            Wrapper = createTestWrapper(createEmptyMocks());
            queryByTestId = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>).queryByTestId;
            act(function () {
                jest.advanceTimersByTime(100);
            });
            expect(queryByTestId("wallet-toggle-button")).toBeNull();
            expect(queryByTestId("next-button")).toBeNull();
            return [2 /*return*/];
        });
    }); });
});
describe("Comprehensive conversion scenarios", function () {
    var scenarios = [
        {
            name: "1. Enter -> type from (BTC) -> validate to (USD) and currency",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }],
        },
        {
            name: "2. Enter -> type from (USD) -> validate to (BTC) and currency",
            options: { btcBalance: 0, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }],
        },
        {
            name: "3. Enter -> type to (USD) -> validate from (BTC) and currency",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }],
        },
        {
            name: "4. Enter -> type to (BTC) -> validate from (USD) and currency",
            options: { btcBalance: 0, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }],
        },
        {
            name: "5. Enter -> type currency (display) -> validate from and to",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }],
        },
        {
            name: "6. Enter -> type from -> focus to -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "from" },
                { type: "focus", field: "to" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "7. Enter -> type from -> focus currency -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "from" },
                { type: "focus", field: "currency" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "8. Enter -> type to -> focus from -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "to" },
                { type: "focus", field: "from" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "9. Enter -> type to -> focus currency -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "to" },
                { type: "focus", field: "currency" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "10. Enter -> type currency -> focus from -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "currency" },
                { type: "focus", field: "from" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "11. Enter -> type currency -> focus to -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "currency" },
                { type: "focus", field: "to" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "12. Enter -> toggle -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "toggle" }, { type: "type", field: "from" }],
        },
        {
            name: "13. Enter -> toggle -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "toggle" }, { type: "type", field: "to" }],
        },
        {
            name: "14. Enter -> toggle -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "toggle" }, { type: "type", field: "currency" }],
        },
        {
            name: "15. Enter -> toggle -> focus from -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "toggle" },
                { type: "focus", field: "from" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "16. Enter -> toggle -> focus to -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "toggle" },
                { type: "focus", field: "to" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "17. Enter -> toggle -> focus currency -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "toggle" },
                { type: "focus", field: "currency" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "18. Enter -> type from -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }, { type: "toggle" }],
        },
        {
            name: "19. Enter -> type to -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }, { type: "toggle" }],
        },
        {
            name: "20. Enter -> type currency -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }, { type: "toggle" }],
        },
        {
            name: "21. Enter -> toggle -> toggle -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "toggle" }, { type: "toggle" }, { type: "type", field: "from" }],
        },
        {
            name: "22. Enter -> toggle -> toggle -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "toggle" }, { type: "toggle" }, { type: "type", field: "to" }],
        },
        {
            name: "23. Enter -> toggle -> toggle -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "toggle" },
                { type: "toggle" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "24. Enter -> type from -> toggle -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }, { type: "toggle" }, { type: "toggle" }],
        },
        {
            name: "25. Enter -> type from -> clear -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "from" },
                { type: "clear", field: "from" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "26. Enter -> type from -> clear -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "from" },
                { type: "clear", field: "from" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "27. Enter -> type from -> clear -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "from" },
                { type: "clear", field: "from" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "28. Enter -> type to -> clear -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "to" },
                { type: "clear", field: "to" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "29. Enter -> type to -> clear -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "to" },
                { type: "clear", field: "to" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "30. Enter -> type to -> clear -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "to" },
                { type: "clear", field: "to" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "31. Enter -> type currency -> clear -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "currency" },
                { type: "clear", field: "currency" },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "32. Enter -> type currency -> clear -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "currency" },
                { type: "clear", field: "currency" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "33. Enter -> type currency -> clear -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "type", field: "currency" },
                { type: "clear", field: "currency" },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "34. Enter -> type -> clear -> toggle -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "from" },
                { type: "clear", field: "from" },
                { type: "toggle" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "35. Enter -> type -> toggle -> clear -> type -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "type", field: "from" },
                { type: "toggle" },
                { type: "clear", field: "from" },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "36. Enter -> 25% -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 25 }],
        },
        {
            name: "37. Enter -> 50% -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 50 }],
        },
        {
            name: "38. Enter -> 75% -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 75 }],
        },
        {
            name: "39. Enter -> 100% -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 100 }],
        },
        {
            name: "40. Enter -> 25% -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 25 }, { type: "toggle" }],
        },
        {
            name: "41. Enter -> 50% -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 50 }, { type: "toggle" }],
        },
        {
            name: "42. Enter -> 100% -> toggle -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "percent", value: 100 }, { type: "toggle" }],
        },
        {
            name: "43. Enter -> percent -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "percent", value: 25 },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "44. Enter -> percent -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "percent", value: 25 },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "45. Enter -> percent -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "percent", value: 25 },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "46. Only BTC balance -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 0 },
            actions: [{ type: "type", field: "from" }],
        },
        {
            name: "47. Only BTC balance -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 0 },
            actions: [{ type: "type", field: "to" }],
        },
        {
            name: "48. Only BTC balance -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 0, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }],
        },
        {
            name: "49. Only USD balance -> type from -> validate",
            options: { btcBalance: 0, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }],
        },
        {
            name: "50. Only USD balance -> type to -> validate",
            options: { btcBalance: 0, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }],
        },
        {
            name: "51. Only USD balance -> type currency -> validate",
            options: { btcBalance: 0, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }],
        },
        {
            name: "52. Only BTC balance -> toggle -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 0 },
            actions: [{ type: "toggle" }, { type: "type", field: "from" }],
        },
        {
            name: "53. Only USD balance -> toggle -> type from -> validate",
            options: { btcBalance: 0, usdBalance: 50000 },
            actions: [{ type: "toggle" }, { type: "type", field: "from" }],
        },
        {
            name: "54. Exceeds balance in from -> conversion and error",
            options: { btcBalance: 50, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }],
            expectError: true,
        },
        {
            name: "55. Exceeds balance in to -> conversion and error",
            options: { btcBalance: 50, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }],
            expectError: true,
        },
        {
            name: "56. Exceeds balance from currency -> conversion and error",
            options: { btcBalance: 50, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }],
            expectError: true,
        },
        {
            name: "57. Valid conversion from -> Next -> validate params",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "from" }, { type: "next" }],
            expectNavigate: true,
        },
        {
            name: "58. Valid conversion to -> Next -> validate params",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "type", field: "to" }, { type: "next" }],
            expectNavigate: true,
        },
        {
            name: "59. Valid conversion currency -> Next -> validate params",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [{ type: "type", field: "currency" }, { type: "next" }],
            expectNavigate: true,
        },
        {
            name: "60. Multiple toggles -> type from -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "multiToggle", count: 3 },
                { type: "type", field: "from" },
            ],
        },
        {
            name: "61. Multiple toggles -> type to -> validate",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [
                { type: "multiToggle", count: 3 },
                { type: "type", field: "to" },
            ],
        },
        {
            name: "62. Multiple toggles -> type currency -> validate",
            options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
            actions: [
                { type: "multiToggle", count: 3 },
                { type: "type", field: "currency" },
            ],
        },
        {
            name: "63. Too small conversion from -> disable next when receive is zero",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "typeDigits", field: "from", digits: ["4", "5", "4", "5", "4"] }],
            expectNextDisabled: true,
        },
        {
            name: "64. Minimum conversion from -> enable next when receive is non-zero",
            options: { btcBalance: 100000, usdBalance: 50000 },
            actions: [{ type: "typeDigits", field: "from", digits: ["4", "5", "4", "5", "5"] }],
            expectNextEnabled: true,
        },
    ];
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it.each(scenarios)("$name", function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        var displayCurrency, Wrapper, _a, getByTestId, getByPlaceholderText, queryByText, fromCurrency, toCurrency, primary, expectedFocusedField, advanceTimers, clearInput, focusField, _loop_1, _i, _b, action, errorNode, nextButton, nextButton, nextButton;
        var _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    displayCurrency = (_c = scenario.options.displayCurrency) !== null && _c !== void 0 ? _c : "USD";
                    Wrapper = createTestWrapper(createGraphQLMocks(scenario.options));
                    _a = render(<Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>), getByTestId = _a.getByTestId, getByPlaceholderText = _a.getByPlaceholderText, queryByText = _a.queryByText;
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByTestId("wallet-toggle-button")).toBeTruthy();
                        })];
                case 1:
                    _g.sent();
                    fromCurrency = getInitialFromCurrency(scenario.options.btcBalance, scenario.options.usdBalance);
                    toCurrency = fromCurrency === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc;
                    primary = null;
                    expectedFocusedField = computeFocusedField(scenario.actions);
                    advanceTimers = function (ms) {
                        act(function () {
                            jest.advanceTimersByTime(ms);
                            jest.runAllTimers();
                        });
                    };
                    clearInput = function (field) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!field) return [3 /*break*/, 2];
                                    return [4 /*yield*/, focusField(field)];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2: return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            pressKeys(getByTestId, Array.from({ length: 10 }, function () { return "⌫"; }));
                                            return [2 /*return*/];
                                        });
                                    }); })];
                                case 3:
                                    _a.sent();
                                    advanceTimers(1500);
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    focusField = function (field) { return __awaiter(void 0, void 0, void 0, function () {
                        var input, _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (!(field === "from")) return [3 /*break*/, 1];
                                    _a = getFromInput(getByPlaceholderText, fromCurrency);
                                    return [3 /*break*/, 5];
                                case 1:
                                    if (!(field === "to")) return [3 /*break*/, 2];
                                    _b = getToInput(getByPlaceholderText, toCurrency);
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, waitFor(function () { return getCurrencyInput(getByPlaceholderText, displayCurrency); })];
                                case 3:
                                    _b = _c.sent();
                                    _c.label = 4;
                                case 4:
                                    _a = _b;
                                    _c.label = 5;
                                case 5:
                                    input = _a;
                                    fireEvent(input, "focus");
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                            return [2 /*return*/];
                                        }); }); })];
                                case 6:
                                    _c.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    _loop_1 = function (action) {
                        var shouldWaitRecalc, i, shouldWaitRecalc, fieldCurrency, digits_1, fieldCurrency, balance;
                        var _h, _j;
                        return __generator(this, function (_k) {
                            switch (_k.label) {
                                case 0:
                                    if (!(action.type === "toggle")) return [3 /*break*/, 2];
                                    shouldWaitRecalc = Boolean(primary && primary.amount > 0);
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                fireEvent.press(getByTestId("wallet-toggle-button"));
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 1:
                                    _k.sent();
                                    advanceTimers(shouldWaitRecalc ? 1500 : 200);
                                    _h = [toCurrency, fromCurrency], fromCurrency = _h[0], toCurrency = _h[1];
                                    if (primary) {
                                        primary = {
                                            currency: DisplayCurrencyType,
                                            amount: convertAmount(primary.amount, primary.currency, DisplayCurrencyType),
                                        };
                                    }
                                    _k.label = 2;
                                case 2:
                                    if (!(action.type === "multiToggle")) return [3 /*break*/, 6];
                                    i = 0;
                                    _k.label = 3;
                                case 3:
                                    if (!(i < action.count)) return [3 /*break*/, 6];
                                    shouldWaitRecalc = Boolean(primary && primary.amount > 0);
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                fireEvent.press(getByTestId("wallet-toggle-button"));
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 4:
                                    _k.sent();
                                    advanceTimers(shouldWaitRecalc ? 1500 : 200);
                                    _j = [toCurrency, fromCurrency], fromCurrency = _j[0], toCurrency = _j[1];
                                    if (primary) {
                                        primary = {
                                            currency: DisplayCurrencyType,
                                            amount: convertAmount(primary.amount, primary.currency, DisplayCurrencyType),
                                        };
                                    }
                                    _k.label = 5;
                                case 5:
                                    i += 1;
                                    return [3 /*break*/, 3];
                                case 6:
                                    if (!(action.type === "focus")) return [3 /*break*/, 8];
                                    return [4 /*yield*/, focusField(action.field)];
                                case 7:
                                    _k.sent();
                                    _k.label = 8;
                                case 8:
                                    if (!(action.type === "type")) return [3 /*break*/, 12];
                                    fieldCurrency = action.field === "from"
                                        ? fromCurrency
                                        : action.field === "to"
                                            ? toCurrency
                                            : DisplayCurrencyType;
                                    return [4 /*yield*/, focusField(action.field)];
                                case 9:
                                    _k.sent();
                                    return [4 /*yield*/, clearInput()];
                                case 10:
                                    _k.sent();
                                    digits_1 = digitsForCurrency(fieldCurrency, displayCurrency);
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                pressKeys(getByTestId, digits_1);
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 11:
                                    _k.sent();
                                    advanceTimers(1500);
                                    primary = {
                                        currency: fieldCurrency,
                                        amount: amountFromDigits(fieldCurrency, digits_1, displayCurrency),
                                    };
                                    _k.label = 12;
                                case 12:
                                    if (!(action.type === "typeDigits")) return [3 /*break*/, 16];
                                    fieldCurrency = action.field === "from"
                                        ? fromCurrency
                                        : action.field === "to"
                                            ? toCurrency
                                            : DisplayCurrencyType;
                                    return [4 /*yield*/, focusField(action.field)];
                                case 13:
                                    _k.sent();
                                    return [4 /*yield*/, clearInput()];
                                case 14:
                                    _k.sent();
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                pressKeys(getByTestId, action.digits);
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 15:
                                    _k.sent();
                                    advanceTimers(1500);
                                    primary = {
                                        currency: fieldCurrency,
                                        amount: amountFromDigits(fieldCurrency, action.digits, displayCurrency),
                                    };
                                    _k.label = 16;
                                case 16:
                                    if (!(action.type === "clear")) return [3 /*break*/, 18];
                                    return [4 /*yield*/, clearInput(action.field)];
                                case 17:
                                    _k.sent();
                                    primary = null;
                                    _k.label = 18;
                                case 18:
                                    if (!(action.type === "percent")) return [3 /*break*/, 20];
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                fireEvent.press(getByTestId("convert-".concat(action.value, "%")));
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 19:
                                    _k.sent();
                                    advanceTimers(1500);
                                    balance = fromCurrency === WalletCurrency.Btc
                                        ? scenario.options.btcBalance
                                        : scenario.options.usdBalance;
                                    primary = {
                                        currency: fromCurrency,
                                        amount: Math.round((balance * action.value) / 100),
                                    };
                                    _k.label = 20;
                                case 20:
                                    if (!(action.type === "next")) return [3 /*break*/, 23];
                                    return [4 /*yield*/, waitFor(function () {
                                            var _a;
                                            var nextButton = getByTestId("next-button");
                                            expect((_a = nextButton.props.accessibilityState) === null || _a === void 0 ? void 0 : _a.disabled).toBe(false);
                                        })];
                                case 21:
                                    _k.sent();
                                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                fireEvent.press(getByTestId("next-button"));
                                                return [2 /*return*/];
                                            });
                                        }); })];
                                case 22:
                                    _k.sent();
                                    _k.label = 23;
                                case 23: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _b = scenario.actions;
                    _g.label = 2;
                case 2:
                    if (!(_i < _b.length)) return [3 /*break*/, 5];
                    action = _b[_i];
                    return [5 /*yield**/, _loop_1(action)];
                case 3:
                    _g.sent();
                    _g.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    if (!primary) {
                        throw new Error("Scenario must set a primary amount to validate conversion.");
                    }
                    return [4 /*yield*/, assertConversionValues({
                            getByPlaceholderText: getByPlaceholderText,
                            primary: primary,
                            fromCurrency: fromCurrency,
                            toCurrency: toCurrency,
                            displayCurrency: displayCurrency,
                            focusedField: expectedFocusedField,
                        })];
                case 6:
                    _g.sent();
                    if (scenario.expectError) {
                        errorNode = queryByText(/Amount exceeds your balance of/i);
                        if (errorNode) {
                            expect(errorNode).toBeTruthy();
                        }
                        if (!errorNode) {
                            nextButton = getByTestId("next-button");
                            expect((_d = nextButton.props.accessibilityState) === null || _d === void 0 ? void 0 : _d.disabled).toBe(true);
                        }
                    }
                    if (scenario.expectNextDisabled) {
                        nextButton = getByTestId("next-button");
                        expect((_e = nextButton.props.accessibilityState) === null || _e === void 0 ? void 0 : _e.disabled).toBe(true);
                    }
                    if (scenario.expectNextEnabled) {
                        nextButton = getByTestId("next-button");
                        expect((_f = nextButton.props.accessibilityState) === null || _f === void 0 ? void 0 : _f.disabled).toBe(false);
                    }
                    if (scenario.expectNavigate) {
                        expect(mockNavigate).toHaveBeenCalledWith("conversionConfirmation", expect.objectContaining({
                            fromWalletCurrency: fromCurrency,
                            moneyAmount: expect.objectContaining({
                                currency: expect.any(String),
                                amount: expect.any(Number),
                            }),
                        }));
                    }
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Conversion calculation verification", function () {
    it("verifies the conversion calculation is mathematically correct", function () {
        var sats = 100000;
        var expectedUsdCents = calculateExpectedUsdFromSats(sats);
        expect(expectedUsdCents).toBeGreaterThan(0);
        expect(Number.isInteger(expectedUsdCents)).toBe(true);
        var backToSats = calculateExpectedSatsFromUsd(expectedUsdCents);
        var tolerance = Math.abs(sats - backToSats) / sats;
        expect(tolerance).toBeLessThan(0.11);
    });
});
//# sourceMappingURL=conversion-details-screen.spec.js.map