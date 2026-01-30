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
import { WebViewScreen } from "@app/screens/webview/webview";
import { ContextForScreen } from "./helper";
jest.mock("react-native-webview", function () {
    var View = jest.requireActual("react-native").View;
    var MockWebView = React.forwardRef(function (props, ref) {
        return <View ref={ref} {...props} testID="webview"/>;
    });
    MockWebView.displayName = "WebView";
    return {
        WebView: MockWebView,
    };
});
jest.mock("react-native-webln", function () { return ({
    injectJs: jest.fn(function () { return ""; }),
    onMessageHandler: jest.fn(function () { return jest.fn(); }),
}); });
var mockRoute = {
    key: "webView",
    name: "webView",
    params: {
        url: "https://example.com",
        initialTitle: "Test Page",
    },
};
var mockRouteWithHeaderTitle = {
    key: "webView",
    name: "webView",
    params: {
        url: "https://verification.example.com/flow?token=test",
        headerTitle: "Identity Verification",
    },
};
var mockRouteForMediaCapture = {
    key: "webView",
    name: "webView",
    params: {
        url: "https://kyc.example.com/webflow?token=test&idDocType=ID_CARD",
        headerTitle: "Card ID Verification",
    },
};
describe("WebViewScreen", function () {
    describe("allowsInlineMediaPlayback property", function () {
        it("should have allowsInlineMediaPlayback enabled on iOS", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: true })); });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRoute}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should have allowsInlineMediaPlayback enabled on Android", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: false })); });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRoute}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("WebView with media playback", function () {
        it("should render WebView with allowsInlineMediaPlayback on iOS", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: true })); });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRouteWithHeaderTitle}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true);
                                expect(webViewInstance.props.source.uri).toContain("verification.example.com");
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should render WebView with allowsInlineMediaPlayback on Android", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: false })); });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRouteWithHeaderTitle}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true);
                                expect(webViewInstance.props.source.uri).toContain("verification.example.com");
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("WebView rendering", function () {
        it("should render WebView with correct URL", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRoute}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.source.uri).toBe("https://example.com");
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should render WebView with custom header title", function () { return __awaiter(void 0, void 0, void 0, function () {
            var customRoute, getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        customRoute = __assign(__assign({}, mockRoute), { params: __assign(__assign({}, mockRoute.params), { headerTitle: "Custom Title" }) });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={customRoute}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("iOS camera overlay for media capture", function () {
        it("should enable inline media playback for iOS camera overlay", function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.doMock("@app/utils/helper", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/helper")), { isIos: true })); });
                        getByTestId = render(<ContextForScreen>
          <WebViewScreen route={mockRouteForMediaCapture}/>
        </ContextForScreen>).getByTestId;
                        return [4 /*yield*/, waitFor(function () {
                                var webViewInstance = getByTestId("webview");
                                expect(webViewInstance).toBeTruthy();
                                expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=webview-screen.spec.js.map