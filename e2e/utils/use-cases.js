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
import { i18nObject } from "../../app/i18n/i18n-util";
import { loadLocale } from "../../app/i18n/i18n-util.sync";
import { timeout } from "./config";
import { clickButton, clickPressable, selector, waitTillPressableDisplayed, waitTillTextDisplayed, } from "./controls";
loadLocale("en");
var LL = i18nObject("en");
export var clickBackButton = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickButton("Go back")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var clickIcon = function (titleOrName) { return __awaiter(void 0, void 0, void 0, function () {
    var iconButton;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(selector(titleOrName, "Other"))];
            case 1:
                iconButton = _a.sent();
                return [4 /*yield*/, iconButton.waitForEnabled({ timeout: timeout })];
            case 2:
                _a.sent();
                return [4 /*yield*/, iconButton.click()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitTillOnHomeScreen = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, waitTillTextDisplayed(LL.HomeScreen.myAccounts())];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitTillSettingDisplayed = function (text) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, waitTillTextDisplayed(text)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var clickOnSetting = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickPressable(title)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var Tab = {
    Home: LL.HomeScreen.title(),
    People: LL.PeopleScreen.title(),
    Map: LL.MapScreen.title(),
    Earn: LL.EarnScreen.title(),
};
export var clickOnBottomTab = function (tab) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickButton(tab)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var addSmallAmount = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickPressable("Amount Input Button")];
            case 1:
                _a.sent();
                return [4 /*yield*/, enter2CentsIntoNumberPad(LL)];
            case 2:
                _a.sent();
                return [4 /*yield*/, waitTillPressableDisplayed("Amount Input Button")];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var enter2CentsIntoNumberPad = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickPressable("Key .")];
            case 1:
                _a.sent();
                return [4 /*yield*/, clickPressable("Key 0")];
            case 2:
                _a.sent();
                return [4 /*yield*/, clickPressable("Key 2")];
            case 3:
                _a.sent();
                return [4 /*yield*/, clickButton(LL.AmountInputScreen.setAmount())];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var screenTitleSelector = function (title) {
    if (process.env.E2E_DEVICE === "ios") {
        return "(//XCUIElementTypeOther[@name=\"".concat(title, "\"])[2]");
    }
    return "android=new UiSelector().text(\"".concat(title, "\")");
};
export var waitTillScreenTitleShowing = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var screenTitle;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(screenTitleSelector(title))];
            case 1:
                screenTitle = _a.sent();
                return [4 /*yield*/, screenTitle.waitForDisplayed({ timeout: timeout })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var isScreenTitleShowing = function (title) { return __awaiter(void 0, void 0, void 0, function () {
    var screenTitle;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $(screenTitleSelector(title))];
            case 1:
                screenTitle = _a.sent();
                return [2 /*return*/, screenTitle.isDisplayed()];
        }
    });
}); };
//# sourceMappingURL=use-cases.js.map