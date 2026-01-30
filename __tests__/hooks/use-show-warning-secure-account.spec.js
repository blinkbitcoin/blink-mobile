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
import * as React from "react";
import { act } from "react-test-renderer";
import { MockedProvider } from "@apollo/client/testing";
import { CurrencyListDocument, RealtimePriceDocument, WarningSecureAccountDocument, } from "@app/graphql/generated";
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context";
import { useShowWarningSecureAccount } from "@app/screens/settings-screen/account/show-warning-secure-account-hook";
import { renderHook } from "@testing-library/react-hooks";
// FIXME: the mockPrice doesn't work as expect.
// it's ok because we have more than $5 in the dollar wallet
var mocksPrice = [
    {
        request: {
            query: RealtimePriceDocument,
        },
        result: {
            data: {
                me: {
                    __typename: "User",
                    id: "70df9822-efe0-419c-b864-c9efa99872ea",
                    defaultAccount: {
                        __typename: "Account",
                        id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        realtimePrice: {
                            btcSatPrice: {
                                base: 24015009766,
                                offset: 12,
                                currencyUnit: "USDCENT",
                                __typename: "PriceOfOneSat",
                            },
                            denominatorCurrency: "USD",
                            id: "67b6e1d2-04c8-509a-abbd-b1cab08575d5",
                            timestamp: 1677184189,
                            usdCentPrice: {
                                base: 100000000,
                                offset: 6,
                                currencyUnit: "USDCENT",
                                __typename: "PriceOfOneUsdCent",
                            },
                            __typename: "RealtimePrice",
                        },
                    },
                },
            },
        },
    },
    {
        request: {
            query: CurrencyListDocument,
        },
        result: {
            data: {
                currencyList: [
                    {
                        flag: "🇳🇬",
                        id: "USD",
                        name: "Usd dollar",
                        symbol: "$",
                        fractionDigits: 2,
                        __typename: "Currency",
                    },
                ],
            },
        },
    },
];
var mockLevelZeroLowBalance = __spreadArray(__spreadArray([], mocksPrice, true), [
    {
        request: {
            query: WarningSecureAccountDocument,
        },
        result: {
            data: {
                me: {
                    id: "70df9822-efe0-419c-b864-c9efa99872ea",
                    language: "",
                    username: "test1",
                    phone: "+50365055539",
                    defaultAccount: {
                        level: "ZERO",
                        id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        defaultWalletId: "f79792e3-282b-45d4-85d5-7486d020def5",
                        wallets: [
                            {
                                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                                balance: 100,
                                walletCurrency: "BTC",
                                __typename: "BTCWallet",
                            },
                            {
                                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                                balance: 100,
                                walletCurrency: "USD",
                                __typename: "UsdWallet",
                            },
                        ],
                        __typename: "ConsumerAccount",
                    },
                    __typename: "User",
                },
            },
        },
    },
], false);
var mockLevelZeroHighBalance = __spreadArray(__spreadArray([], mocksPrice, true), [
    {
        request: {
            query: WarningSecureAccountDocument,
        },
        result: {
            data: {
                me: {
                    id: "70df9822-efe0-419c-b864-c9efa99872ea",
                    defaultAccount: {
                        level: "ZERO",
                        id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        wallets: [
                            {
                                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                                balance: 100,
                                walletCurrency: "BTC",
                                __typename: "BTCWallet",
                            },
                            {
                                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                                balance: 600,
                                walletCurrency: "USD",
                                __typename: "UsdWallet",
                            },
                        ],
                        __typename: "ConsumerAccount",
                    },
                    __typename: "User",
                },
            },
        },
    },
], false);
var mockLevelOneHighBalance = __spreadArray(__spreadArray([], mocksPrice, true), [
    {
        request: {
            query: WarningSecureAccountDocument,
        },
        result: {
            data: {
                me: {
                    id: "70df9822-efe0-419c-b864-c9efa99872ea",
                    defaultAccount: {
                        level: "ONE",
                        id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        wallets: [
                            {
                                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                                balance: 100,
                                walletCurrency: "BTC",
                                __typename: "BTCWallet",
                            },
                            {
                                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                                balance: 600,
                                walletCurrency: "USD",
                                __typename: "UsdWallet",
                            },
                        ],
                        __typename: "ConsumerAccount",
                    },
                    __typename: "User",
                },
            },
        },
    },
], false);
/* eslint-disable react/display-name */
/* eslint @typescript-eslint/ban-ts-comment: "off" */
export var wrapWithCache = 
// @ts-ignore-next-line no-implicit-any error
function (mocks) {
    return function (_a) {
        var children = _a.children;
        return (<IsAuthedContextProvider value={true}>
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        </IsAuthedContextProvider>);
    };
};
describe("useShowWarningSecureAccount", function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("return false with level 0 and no balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    result = renderHook(useShowWarningSecureAccount, {
                        wrapper: wrapWithCache(mockLevelZeroLowBalance),
                    }).result;
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(result.current).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("return true with level 0 and more than $5 balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, unmount;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = renderHook(useShowWarningSecureAccount, {
                        wrapper: wrapWithCache(mockLevelZeroHighBalance),
                    }), result = _a.result, unmount = _a.unmount;
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _b.sent();
                    expect(result.current).toBe(true);
                    unmount();
                    return [2 /*return*/];
            }
        });
    }); });
    it("return false with level 1 and more than $5 balance", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    result = renderHook(useShowWarningSecureAccount, {
                        wrapper: wrapWithCache(mockLevelOneHighBalance),
                    }).result;
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(result.current).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=use-show-warning-secure-account.spec.js.map