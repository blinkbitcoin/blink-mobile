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
var timeout = 30000;
export var selector = function (id, iosType, iosExtraXPath) {
    if (process.env.E2E_DEVICE === "ios") {
        return "//XCUIElementType".concat(iosType, "[@name=\"").concat(id, "\"]").concat(iosExtraXPath !== null && iosExtraXPath !== void 0 ? iosExtraXPath : "");
    }
    return "~".concat(id);
};
var findById = function (id, iosType, iosExtraXPath) {
    if (process.env.E2E_DEVICE === "ios") {
        return "//XCUIElementType".concat(iosType, "[@name=\"").concat(id, "\"]").concat(iosExtraXPath !== null && iosExtraXPath !== void 0 ? iosExtraXPath : "");
    }
    return "id=".concat(id);
};
export var clickAlertLastButton = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var okButtonId, okButton;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                okButtonId = process.env.E2E_DEVICE === "ios" ? title : "android:id/button1";
                return [4 /*yield*/, $(findById(okButtonId, "Button"))];
            case 1:
                okButton = _a.sent();
                return [4 /*yield*/, okButton.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [4 /*yield*/, okButton.click()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var clickButton = function (title_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([title_1], args_1, true), void 0, function (title, wait) {
        var button;
        if (wait === void 0) { wait = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(title, "Button"))];
                case 1:
                    button = _a.sent();
                    if (!wait) return [3 /*break*/, 3];
                    return [4 /*yield*/, button.waitForEnabled({ timeout: timeout })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [4 /*yield*/, button.click()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
};
export var waitTillButtonDisplayed = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var button;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(selector(title, "Button"))];
            case 1:
                button = _a.sent();
                return [4 /*yield*/, button.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var clickPressable = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var button;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(selector(title, "Other"))];
            case 1:
                button = _a.sent();
                return [4 /*yield*/, button.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [4 /*yield*/, button.click()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitTillPressableDisplayed = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var button;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(selector(title, "Other"))];
            case 1:
                button = _a.sent();
                return [4 /*yield*/, button.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export function swipeLeft() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, height, width, y, toX, fromX, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, browser.getWindowRect()];
                case 1:
                    _a = _b.sent(), height = _a.height, width = _a.width;
                    y = height / 2;
                    toX = width / 8;
                    fromX = width - toX;
                    return [4 /*yield*/, browser.touchAction([
                            { action: "press", x: fromX, y: y },
                            { action: "wait", ms: 500 },
                            { action: "moveTo", x: toX, y: y },
                            "release",
                        ])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _b.sent();
                    console.error(err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
export function swipeRight() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, height, width, y, fromX, toX, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, browser.getWindowRect()];
                case 1:
                    _a = _b.sent(), height = _a.height, width = _a.width;
                    y = height / 2;
                    fromX = width / 8;
                    toX = width - fromX;
                    return [4 /*yield*/, browser.touchAction([
                            { action: "press", x: fromX, y: y },
                            { action: "wait", ms: 500 },
                            { action: "moveTo", x: toX, y: y },
                            "release",
                        ])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _b.sent();
                    console.error(err_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
export var setInputValue = function (el, value) { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, el.clearValue()];
            case 1:
                _a.sent();
                return [4 /*yield*/, value.split("").reduce(function (prev, current) { return __awaiter(void 0, void 0, void 0, function () {
                        var nextString, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = "".concat;
                                    return [4 /*yield*/, prev];
                                case 1:
                                    nextString = _a.apply("", [_b.sent()]).concat(current);
                                    return [4 /*yield*/, el.addValue(current)];
                                case 2:
                                    _b.sent();
                                    return [4 /*yield*/, el.waitUntil(
                                        // eslint-disable-next-line func-names
                                        function () {
                                            return __awaiter(this, void 0, void 0, function () {
                                                var text;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, el.getText()];
                                                        case 1:
                                                            text = _a.sent();
                                                            return [2 /*return*/, text === nextString];
                                                    }
                                                });
                                            });
                                        }, {
                                            timeout: 120000,
                                            interval: 10,
                                        })];
                                case 3:
                                    _b.sent();
                                    return [2 /*return*/, nextString];
                            }
                        });
                    }); }, Promise.resolve(""))];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                console.log("SetInputValue Error:", e_1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
export var enter = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 2];
                return [4 /*yield*/, input.sendKeys(["\n"])];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [4 /*yield*/, browser.pressKeyCode(66)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export function scrollDown() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, height, width, x, toY, fromY, err_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, browser.getWindowRect()];
                case 1:
                    _a = _b.sent(), height = _a.height, width = _a.width;
                    x = width / 2;
                    toY = height / 8;
                    fromY = height - height / 8;
                    return [4 /*yield*/, browser.touchAction([
                            { action: "press", x: x, y: fromY },
                            { action: "wait", ms: 500 },
                            { action: "moveTo", x: x, y: toY },
                            "release",
                        ])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _b.sent();
                    console.error(err_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
export function scrollUp() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, height, width, x, toY, fromY, err_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, browser.getWindowRect()];
                case 1:
                    _a = _b.sent(), height = _a.height, width = _a.width;
                    x = width / 2;
                    toY = height - height / 4;
                    fromY = height / 4;
                    return [4 /*yield*/, browser.touchAction([
                            { action: "press", x: x, y: fromY },
                            { action: "wait", ms: 500 },
                            { action: "moveTo", x: x, y: toY },
                            "release",
                        ])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _b.sent();
                    console.error(err_4);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
export var scrollDownOnLeftSideOfScreen = function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, height, width, x, toY, fromY;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, browser.getWindowRect()];
            case 1:
                _a = _b.sent(), height = _a.height, width = _a.width;
                x = width / 4;
                toY = height / 2;
                fromY = height - height / 4;
                return [4 /*yield*/, browser.touchAction([
                        { action: "press", x: x, y: fromY },
                        { action: "wait", ms: 500 },
                        { action: "moveTo", x: x, y: toY },
                        "release",
                    ])];
            case 2:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitTillTextDisplayed = function (text) { return __awaiter(void 0, void 0, void 0, function () {
    var elementSelector, textElement;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.E2E_DEVICE === "ios") {
                    elementSelector = "//XCUIElementTypeStaticText[@name=\"".concat(text, "\"]");
                }
                else {
                    elementSelector = "android=new UiSelector().text(\"".concat(text, "\").className(\"android.widget.TextView\")");
                }
                return [4 /*yield*/, $(elementSelector)];
            case 1:
                textElement = _a.sent();
                return [4 /*yield*/, textElement.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var clickOnText = function (text) { return __awaiter(void 0, void 0, void 0, function () {
    var elementSelector, textElement;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.E2E_DEVICE === "ios") {
                    elementSelector = "//XCUIElementTypeStaticText[@name=\"".concat(text, "\"]");
                }
                else {
                    elementSelector = "android=new UiSelector().text(\"".concat(text, "\").className(\"android.widget.TextView\")");
                }
                return [4 /*yield*/, $(elementSelector)];
            case 1:
                textElement = _a.sent();
                return [4 /*yield*/, textElement.waitForEnabled({ timeout: timeout })];
            case 2:
                _a.sent();
                return [4 /*yield*/, textElement.click()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var swipeButton = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var sliderButton, location, size, thumbWidthPercentage, thumbWidth, startX, startY, endX;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(selector(title, "Other"))];
            case 1:
                sliderButton = _a.sent();
                return [4 /*yield*/, sliderButton.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [4 /*yield*/, sliderButton.getLocation()];
            case 3:
                location = _a.sent();
                return [4 /*yield*/, sliderButton.getSize()];
            case 4:
                size = _a.sent();
                thumbWidthPercentage = 0.1;
                thumbWidth = size.width * thumbWidthPercentage;
                startX = location.x + thumbWidth;
                startY = location.y + size.height / 2;
                endX = location.x + size.width;
                return [4 /*yield*/, driver.touchAction([
                        { action: "press", x: startX, y: startY },
                        { action: "wait", ms: 1500 },
                        { action: "moveTo", x: endX, y: startY },
                        "release",
                    ])];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=controls.js.map