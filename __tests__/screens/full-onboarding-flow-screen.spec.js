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
import { it } from "@jest/globals";
import { render, waitFor } from "@testing-library/react-native";
import { FullOnboardingFlowScreen } from "@app/screens/full-onboarding-flow/full-onboarding-flow";
import { FullOnboardingScreenDocument, KycFlowStartDocument, OnboardingStatus, } from "@app/graphql/generated";
import { ContextForScreen } from "./helper";
var currentMocks = [];
jest.mock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: true })); });
jest.mock("@app/graphql/mocks", function () { return ({
    __esModule: true,
    get default() {
        return currentMocks;
    },
}); });
var mockNavigate = jest.fn();
var mockGoBack = jest.fn();
jest.mock("@react-navigation/native", function () {
    var actual = jest.requireActual("@react-navigation/native");
    return __assign(__assign({}, actual), { useNavigation: function () {
            var _a;
            return (__assign(__assign({}, (_a = actual.useNavigation) === null || _a === void 0 ? void 0 : _a.call(actual)), { navigate: mockNavigate, goBack: mockGoBack }));
        } });
});
jest.mock("@app/hooks", function () {
    var actual = jest.requireActual("@app/hooks");
    return __assign(__assign({}, actual), { useAppConfig: function () { return ({
            appConfig: {
                galoyInstance: {
                    kycUrl: "https://kyc.example.com",
                },
            },
        }); } });
});
var generateFullOnboardingMock = function (_a) {
    var onboardingStatus = _a.onboardingStatus;
    return [
        {
            request: { query: FullOnboardingScreenDocument },
            result: {
                data: {
                    me: {
                        __typename: "User",
                        id: "user-id",
                        defaultAccount: {
                            __typename: "ConsumerAccount",
                            id: "account-id",
                            onboardingStatus: onboardingStatus,
                        },
                    },
                },
            },
        },
        {
            request: {
                query: KycFlowStartDocument,
                variables: {
                    input: {
                        firstName: "",
                        lastName: "",
                    },
                },
            },
            result: {
                data: {
                    kycFlowStart: {
                        __typename: "KycFlowStartPayload",
                        workflowRunId: "workflow-123",
                        tokenWeb: "test-token-web-123",
                    },
                },
            },
        },
    ];
};
describe("FullOnboardingFlowScreen", function () {
    beforeEach(function () {
        currentMocks = [];
        jest.clearAllMocks();
    });
    describe("WebView navigation for KYC flow", function () {
        it("should navigate to WebView with correct params when onboardingStatus is AWAITING_INPUT", function () { return __awaiter(void 0, void 0, void 0, function () {
            var navigationCall;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentMocks = generateFullOnboardingMock({
                            onboardingStatus: OnboardingStatus.AwaitingInput,
                        });
                        render(<ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>);
                        return [4 /*yield*/, waitFor(function () {
                                expect(mockNavigate).toHaveBeenCalledWith("webView", expect.objectContaining({
                                    url: expect.stringContaining("https://kyc.example.com/webflow"),
                                    headerTitle: expect.any(String),
                                }));
                            })];
                    case 1:
                        _a.sent();
                        navigationCall = mockNavigate.mock.calls[0];
                        expect(navigationCall[1].url).toContain("token=test-token-web-123");
                        return [2 /*return*/];
                }
            });
        }); });
        it("should include theme parameter in KYC URL", function () { return __awaiter(void 0, void 0, void 0, function () {
            var navigationCall;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentMocks = generateFullOnboardingMock({
                            onboardingStatus: OnboardingStatus.AwaitingInput,
                        });
                        render(<ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>);
                        return [4 /*yield*/, waitFor(function () {
                                expect(mockNavigate).toHaveBeenCalled();
                            })];
                    case 1:
                        _a.sent();
                        navigationCall = mockNavigate.mock.calls[0];
                        expect(navigationCall[1].url).toMatch(/theme=(dark|light)/);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("Onboarding status handling", function () {
        it("should not navigate when onboardingStatus is APPROVED", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentMocks = generateFullOnboardingMock({
                            onboardingStatus: OnboardingStatus.Approved,
                        });
                        render(<ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>);
                        return [4 /*yield*/, waitFor(function () {
                                expect(mockNavigate).not.toHaveBeenCalled();
                            }, { timeout: 500 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should not navigate when onboardingStatus is PROCESSING", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentMocks = generateFullOnboardingMock({
                            onboardingStatus: OnboardingStatus.Processing,
                        });
                        render(<ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>);
                        return [4 /*yield*/, waitFor(function () {
                                expect(mockNavigate).not.toHaveBeenCalled();
                            }, { timeout: 500 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should render properly when onboardingStatus is NOT_STARTED", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentMocks = generateFullOnboardingMock({
                            onboardingStatus: OnboardingStatus.NotStarted,
                        });
                        getByTestId = render(<ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                expect(getByTestId("RNE_BUTTON_WRAPPER")).toBeTruthy();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=full-onboarding-flow-screen.spec.js.map