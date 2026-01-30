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
import { act, fireEvent, render, screen, waitFor, within, } from "@testing-library/react-native";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { Success, Queued, Pending, SuccessAction, } from "@app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.stories";
import { ContextForScreen } from "./helper";
import { Linking, View } from "react-native";
jest.mock("react-native-in-app-review", function () { return ({
    isAvailable: function () { return true; },
    RequestInAppReview: jest.fn(),
}); });
jest.mock("react-native-view-shot", function () {
    return {
        __esModule: true,
        default: function (_a) {
            var children = _a.children;
            return <View>{children}</View>;
        },
    };
});
jest.useFakeTimers();
describe("SendBitcoinCompletedScreen", function () {
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("renders the Success state correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var successTextElement;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <Success />
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () { return screen.findByTestId("Success Text"); })];
                case 1:
                    successTextElement = _a.sent();
                    expect(within(successTextElement).getByTestId("SUCCESS")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders the Queued state correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var queuedTextElement;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <Queued />
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () { return screen.findByTestId("Success Text"); })];
                case 1:
                    queuedTextElement = _a.sent();
                    expect(within(queuedTextElement).getByTestId("QUEUED")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders the Pending state correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var pendingTextElement;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <Pending />
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () { return screen.findByTestId("Success Text"); })];
                case 1:
                    pendingTextElement = _a.sent();
                    expect(within(pendingTextElement).getByTestId("PENDING")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("render successAction - LUD 09 - message", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lud09MessageRoute;
        return __generator(this, function (_a) {
            lud09MessageRoute = {
                key: "sendBitcoinCompleted",
                name: "sendBitcoinCompleted",
                params: {
                    status: "SUCCESS",
                    successAction: {
                        tag: "message",
                        description: "",
                        url: null,
                        message: "Thanks for your support.",
                        ciphertext: null,
                        iv: null,
                        decipher: function () { return null; },
                    },
                    currencyAmount: "$0.03",
                    satAmount: "25 SAT",
                    currencyFeeAmount: "$0.00",
                    satFeeAmount: "0 SAT",
                    destination: "moises",
                    paymentType: "lightning",
                    createdAt: 1747691078,
                },
            };
            render(<ContextForScreen>
        <SuccessAction route={lud09MessageRoute}/>
      </ContextForScreen>);
            act(function () {
                jest.advanceTimersByTime(2300);
            });
            expect(screen.getByText(lud09MessageRoute.params.successAction.message)).toBeTruthy();
            expect(screen.getByText(lud09MessageRoute.params.currencyAmount)).toBeTruthy();
            expect(screen.getByText(lud09MessageRoute.params.currencyFeeAmount)).toBeTruthy();
            expect(screen.getByText(lud09MessageRoute.params.paymentType)).toBeTruthy();
            expect(screen.getByText(lud09MessageRoute.params.destination)).toBeTruthy();
            expect(screen.getByText(LL.common.share())).toBeTruthy();
            return [2 /*return*/];
        });
    }); });
    it("render successAction - LUD 09 - URL", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lud09URLRoute, button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lud09URLRoute = {
                        key: "sendBitcoinCompleted",
                        name: "sendBitcoinCompleted",
                        params: {
                            status: "SUCCESS",
                            successAction: {
                                tag: "url",
                                description: null,
                                url: "https://es.blink.sv",
                                message: null,
                                ciphertext: null,
                                iv: null,
                                decipher: function () { return null; },
                            },
                            currencyAmount: "$0.03",
                            satAmount: "25 SAT",
                            currencyFeeAmount: "$0.00",
                            satFeeAmount: "0 SAT",
                            destination: "moises",
                            paymentType: "lightning",
                            createdAt: 1747691078,
                        },
                    };
                    render(<ContextForScreen>
        <SuccessAction route={lud09URLRoute}/>
      </ContextForScreen>);
                    act(function () {
                        jest.advanceTimersByTime(2300);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            return screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle());
                        })];
                case 1:
                    button = _a.sent();
                    expect(button).toBeTruthy();
                    fireEvent.press(button);
                    expect(Linking.openURL).toHaveBeenCalledWith(lud09URLRoute.params.successAction.url);
                    expect(screen.getByText(lud09URLRoute.params.successAction.url)).toBeTruthy();
                    expect(screen.getByText(lud09URLRoute.params.currencyAmount)).toBeTruthy();
                    expect(screen.getByText(lud09URLRoute.params.currencyFeeAmount)).toBeTruthy();
                    expect(screen.getByText(lud09URLRoute.params.paymentType)).toBeTruthy();
                    expect(screen.getByText(lud09URLRoute.params.destination)).toBeTruthy();
                    expect(screen.getByText(LL.common.share())).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("render successAction - LUD 09 - URL with description", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lud09URLWithDescRoute, button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lud09URLWithDescRoute = {
                        key: "sendBitcoinCompleted",
                        name: "sendBitcoinCompleted",
                        params: {
                            status: "SUCCESS",
                            successAction: {
                                tag: "url",
                                description: "Example URL + description",
                                url: "https://es.blink.sv",
                                message: null,
                                ciphertext: null,
                                iv: null,
                                decipher: function () { return null; },
                            },
                            currencyAmount: "$0.03",
                            satAmount: "25 SAT",
                            currencyFeeAmount: "$0.00",
                            satFeeAmount: "0 SAT",
                            destination: "moises",
                            paymentType: "lightning",
                            createdAt: 1747691078,
                        },
                    };
                    render(<ContextForScreen>
        <SuccessAction route={lud09URLWithDescRoute}/>
      </ContextForScreen>);
                    act(function () {
                        jest.advanceTimersByTime(2300);
                    });
                    return [4 /*yield*/, waitFor(function () {
                            return screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle());
                        })];
                case 1:
                    button = _a.sent();
                    expect(button).toBeTruthy();
                    fireEvent.press(button);
                    expect(Linking.openURL).toHaveBeenCalledWith(lud09URLWithDescRoute.params.successAction.url);
                    expect(screen.getByText(lud09URLWithDescRoute.params.successAction.description, {
                        exact: false,
                    })).toBeTruthy();
                    expect(screen.getByText(lud09URLWithDescRoute.params.successAction.url)).toBeTruthy();
                    expect(screen.getByText(lud09URLWithDescRoute.params.currencyAmount)).toBeTruthy();
                    expect(screen.getByText(lud09URLWithDescRoute.params.currencyFeeAmount)).toBeTruthy();
                    expect(screen.getByText(lud09URLWithDescRoute.params.paymentType)).toBeTruthy();
                    expect(screen.getByText(lud09URLWithDescRoute.params.destination)).toBeTruthy();
                    expect(screen.getByText(LL.common.share())).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("render successAction - LUD 10 - message", function () { return __awaiter(void 0, void 0, void 0, function () {
        var encryptedMessage, lud10AESRoute;
        return __generator(this, function (_a) {
            encryptedMessage = "131313";
            lud10AESRoute = {
                key: "sendBitcoinCompleted",
                name: "sendBitcoinCompleted",
                params: {
                    status: "SUCCESS",
                    successAction: {
                        tag: "aes",
                        description: "Here is your redeem code",
                        url: null,
                        message: null,
                        ciphertext: "564u3BEMRefWUV1098gJ5w==",
                        iv: "IhkC5ktKB9LG91FvlbN2kg==",
                        decipher: function () { return null; },
                    },
                    preimage: "25004cd52960a3bac983e3f95c432341a7052cef37b9253b0b0b1256d754559b",
                    currencyAmount: "$0.03",
                    satAmount: "25 SAT",
                    currencyFeeAmount: "$0.00",
                    satFeeAmount: "0 SAT",
                    destination: "moises",
                    paymentType: "lightning",
                    createdAt: 1747691078,
                },
            };
            render(<ContextForScreen>
        <SuccessAction route={lud10AESRoute}/>
      </ContextForScreen>);
            act(function () {
                jest.advanceTimersByTime(2300);
            });
            expect(screen.getByText("".concat(lud10AESRoute.params.successAction.description, " ").concat(encryptedMessage))).toBeTruthy();
            expect(screen.getByText(lud10AESRoute.params.currencyAmount)).toBeTruthy();
            expect(screen.getByText(lud10AESRoute.params.currencyFeeAmount)).toBeTruthy();
            expect(screen.getByText(lud10AESRoute.params.paymentType)).toBeTruthy();
            expect(screen.getByText(lud10AESRoute.params.destination)).toBeTruthy();
            expect(screen.getByText(LL.common.share())).toBeTruthy();
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=send-bitcoin-completed-screen.spec.js.map