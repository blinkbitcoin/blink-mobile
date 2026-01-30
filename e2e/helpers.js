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
import { clickAlertLastButton, clickBackButton, clickButton, clickIcon, scrollDown, selector, setUserToken, sleep, timeout, waitTillTextDisplayed, } from "./utils";
export var getAccessTokenFromClipboard = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    var buildButton, token, accessTokenSharedScreen, tokenBase64;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, clickIcon("menu")];
            case 1:
                _a.sent();
                if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 3];
                return [4 /*yield*/, waitTillTextDisplayed(LL.common.preferences())];
            case 2:
                _a.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, sleep(1000)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [4 /*yield*/, scrollDown()];
            case 6:
                _a.sent();
                return [4 /*yield*/, $(selector("Version Build Text", "StaticText"))];
            case 7:
                buildButton = _a.sent();
                return [4 /*yield*/, buildButton.waitForDisplayed({ timeout: timeout })];
            case 8:
                _a.sent();
                return [4 /*yield*/, buildButton.click()];
            case 9:
                _a.sent();
                return [4 /*yield*/, browser.pause(100)];
            case 10:
                _a.sent();
                return [4 /*yield*/, buildButton.click()];
            case 11:
                _a.sent();
                return [4 /*yield*/, browser.pause(100)];
            case 12:
                _a.sent();
                return [4 /*yield*/, buildButton.click()];
            case 13:
                _a.sent();
                return [4 /*yield*/, browser.pause(100)];
            case 14:
                _a.sent();
                return [4 /*yield*/, scrollDown()];
            case 15:
                _a.sent();
                return [4 /*yield*/, browser.pause(200)];
            case 16:
                _a.sent();
                return [4 /*yield*/, scrollDown()];
            case 17:
                _a.sent();
                token = "";
                if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 23];
                // on ios, get invoice from share link because copy does not
                // work on physical device for security reasons
                return [4 /*yield*/, clickButton("Share access token")];
            case 18:
                // on ios, get invoice from share link because copy does not
                // work on physical device for security reasons
                _a.sent();
                return [4 /*yield*/, $('//*[contains(@name,"ory_st")]')];
            case 19:
                accessTokenSharedScreen = _a.sent();
                return [4 /*yield*/, accessTokenSharedScreen.waitForDisplayed({
                        timeout: 8000,
                    })];
            case 20:
                _a.sent();
                return [4 /*yield*/, accessTokenSharedScreen.getAttribute("name")];
            case 21:
                token = _a.sent();
                return [4 /*yield*/, clickButton("Close")];
            case 22:
                _a.sent();
                return [3 /*break*/, 27];
            case 23: 
            // get from clipboard in android
            return [4 /*yield*/, clickButton("Copy access token")];
            case 24:
                // get from clipboard in android
                _a.sent();
                return [4 /*yield*/, browser.pause(200)];
            case 25:
                _a.sent();
                return [4 /*yield*/, browser.getClipboard()];
            case 26:
                tokenBase64 = _a.sent();
                token = Buffer.from(tokenBase64, "base64").toString();
                _a.label = 27;
            case 27:
                expect(token).not.toBe("");
                setUserToken(token);
                if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 31];
                return [4 /*yield*/, browser.pause(100)];
            case 28:
                _a.sent();
                return [4 /*yield*/, clickAlertLastButton(LL.common.ok())];
            case 29:
                _a.sent();
                return [4 /*yield*/, browser.pause(100)];
            case 30:
                _a.sent();
                _a.label = 31;
            case 31: return [4 /*yield*/, clickBackButton()];
            case 32:
                _a.sent();
                return [4 /*yield*/, browser.pause(100)];
            case 33:
                _a.sent();
                return [4 /*yield*/, clickBackButton()];
            case 34:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=helpers.js.map