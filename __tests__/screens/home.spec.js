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
import { it } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { HomeScreen } from "../../app/screens/home-screen";
import { ContextForScreen } from "./helper";
import { AccountLevel, HomeAuthedDocument, HomeUnauthedDocument, Network, } from "@app/graphql/generated";
var currentMocks = [];
jest.mock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: true })); });
jest.mock("@app/hooks", function () {
    var actual = jest.requireActual("@app/hooks");
    return __assign(__assign({}, actual), { usePriceConversion: function () { return ({
            convertMoneyAmount: function (_a) {
                var amount = _a.amount;
                return ({
                    amount: amount,
                    currency: "DisplayCurrency",
                    currencyCode: "USD",
                });
            },
        }); } });
});
jest.mock("@app/graphql/mocks", function () { return ({
    __esModule: true,
    get default() {
        return currentMocks;
    },
}); });
jest.mock("@app/components/slide-up-handle", function () {
    var React = jest.requireActual("react");
    var _a = jest.requireActual("react-native"), TouchableOpacity = _a.TouchableOpacity, Text = _a.Text;
    var MockSlideUpHandle = function (_a) {
        var onAction = _a.onAction, _b = _a.testID, testID = _b === void 0 ? "slide-up-handle" : _b;
        return (<TouchableOpacity testID={testID} onPress={onAction}>
      <Text>Slide up</Text>
    </TouchableOpacity>);
    };
    return { __esModule: true, default: MockSlideUpHandle };
});
var mockNavigate = jest.fn();
jest.mock("@react-navigation/native", function () {
    var actual = jest.requireActual("@react-navigation/native");
    return __assign(__assign({}, actual), { useNavigation: function () {
            var _a;
            return (__assign(__assign({}, (_a = actual.useNavigation) === null || _a === void 0 ? void 0 : _a.call(actual)), { navigate: mockNavigate }));
        } });
});
jest.mock("@react-native-firebase/app-check", function () {
    return function () { return ({
        initializeAppCheck: jest.fn(),
        getToken: jest.fn(),
        newReactNativeFirebaseAppCheckProvider: function () { return ({
            configure: jest.fn(),
        }); },
    }); };
});
jest.mock("react-native-config", function () {
    return {
        APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
        APP_CHECK_IOS_DEBUG_TOKEN: "token",
    };
});
export var generateHomeMock = function (_a) {
    var level = _a.level, network = _a.network, btcBalance = _a.btcBalance, usdBalance = _a.usdBalance;
    return [
        {
            request: { query: HomeUnauthedDocument },
            result: {
                data: {
                    __typename: "Query",
                    globals: {
                        __typename: "Globals",
                        network: network,
                    },
                    currencyList: [],
                },
            },
        },
        {
            request: { query: HomeAuthedDocument },
            result: {
                data: {
                    me: {
                        __typename: "User",
                        id: "user-id",
                        defaultAccount: {
                            __typename: "ConsumerAccount",
                            id: "account-id",
                            level: level,
                            defaultWalletId: "btc-wallet",
                            wallets: [
                                {
                                    __typename: "BTCWallet",
                                    id: "btc-wallet",
                                    balance: btcBalance,
                                    walletCurrency: "BTC",
                                },
                                {
                                    __typename: "UsdWallet",
                                    id: "usd-wallet",
                                    balance: usdBalance,
                                    walletCurrency: "USD",
                                },
                            ],
                            transactions: {
                                __typename: "TransactionConnection",
                                edges: [],
                                pageInfo: {
                                    __typename: "PageInfo",
                                    hasNextPage: false,
                                    hasPreviousPage: false,
                                    startCursor: null,
                                    endCursor: null,
                                },
                            },
                            pendingIncomingTransactions: [],
                        },
                    },
                },
            },
        },
    ];
};
var iosCases = [
    {
        description: "iOS + mainnet + ONE + no balance --> hidden",
        isIos: true,
        level: AccountLevel.One,
        network: Network.Mainnet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: false,
    },
    {
        description: "iOS + mainnet + ONE + has balance --> shown",
        isIos: true,
        level: AccountLevel.One,
        network: Network.Mainnet,
        btcBalance: 1000,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "iOS + mainnet + TWO + no balance --> shown",
        isIos: true,
        level: AccountLevel.Two,
        network: Network.Mainnet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "iOS + mainnet + THREE + no balance --> shown",
        isIos: true,
        level: AccountLevel.Three,
        network: Network.Mainnet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "iOS + signet + ONE + no balance --> shown",
        isIos: true,
        level: AccountLevel.One,
        network: Network.Signet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "iOS + regtest + ONE + no balance --> shown",
        isIos: true,
        level: AccountLevel.One,
        network: Network.Regtest,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "iOS + testnet + ONE + no balance --> shown",
        isIos: true,
        level: AccountLevel.One,
        network: Network.Testnet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
];
var androidCases = [
    {
        description: "Android + signet + ONE + no balance --> shown",
        isIos: false,
        level: AccountLevel.One,
        network: Network.Signet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "Android + regtest + ONE + has balance --> shown",
        isIos: false,
        level: AccountLevel.One,
        network: Network.Regtest,
        btcBalance: 0,
        usdBalance: 5000,
        expectConvertButton: true,
    },
    {
        description: "Android + signet + TWO + has balance --> shown",
        isIos: false,
        level: AccountLevel.Two,
        network: Network.Signet,
        btcBalance: 2000,
        usdBalance: 0,
        expectConvertButton: true,
    },
    {
        description: "Android + regtest + THREE + has balance --> shown",
        isIos: false,
        level: AccountLevel.Three,
        network: Network.Regtest,
        btcBalance: 3000,
        usdBalance: 3000,
        expectConvertButton: true,
    },
    {
        description: "Android + mainnet + ONE + no balance --> shown",
        isIos: false,
        level: AccountLevel.One,
        network: Network.Mainnet,
        btcBalance: 0,
        usdBalance: 0,
        expectConvertButton: true,
    },
];
describe("HomeScreen", function () {
    beforeEach(function () {
        currentMocks = [];
        jest.clearAllMocks();
    });
    it("HomeAuthed", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <HomeScreen />
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it.each(__spreadArray(__spreadArray([], iosCases, true), androidCases, true))("%s", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var getByTestId;
        var isIos = _b.isIos, level = _b.level, network = _b.network, btcBalance = _b.btcBalance, usdBalance = _b.usdBalance, expectConvertButton = _b.expectConvertButton;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: isIos })); });
                    currentMocks = generateHomeMock({ level: level, network: network, btcBalance: btcBalance, usdBalance: usdBalance });
                    getByTestId = render(<ContextForScreen>
          <HomeScreen />
        </ContextForScreen>).getByTestId;
                    if (!expectConvertButton) return [3 /*break*/, 2];
                    return [4 /*yield*/, waitFor(function () { return expect(getByTestId("transfer")).toBeTruthy(); })];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, waitFor(function () { return expect(function () { return getByTestId("transfer"); }).toThrow(); })];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Slide-up handle triggers navigation to transaction history", function () { return __awaiter(void 0, void 0, void 0, function () {
        var getByTestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockNavigate.mockClear();
                    getByTestId = render(<ContextForScreen>
        <HomeScreen />
      </ContextForScreen>).getByTestId;
                    fireEvent.press(getByTestId("slide-up-handle"));
                    return [4 /*yield*/, waitFor(function () { return expect(mockNavigate).toHaveBeenCalledWith("transactionHistory"); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=home.spec.js.map