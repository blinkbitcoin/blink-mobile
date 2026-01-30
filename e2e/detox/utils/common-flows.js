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
import { timeout } from "./config";
import { tap } from "./controls";
export var waitForSettingsScreen = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    var el;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                el = element(by.text(LL.SettingsScreen.addressScreen()));
                return [4 /*yield*/, waitFor(el)
                        .toBeVisible()
                        .withTimeout(timeout * 3)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitForAccountScreen = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    var el;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                el = element(by.text(LL.AccountScreen.accountId()));
                return [4 /*yield*/, waitFor(el)
                        .toBeVisible()
                        .withTimeout(timeout * 3)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var waitForHomeScreen = function (LL) { return __awaiter(void 0, void 0, void 0, function () {
    var el;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                el = element(by.id(LL.HomeScreen.myAccounts()));
                return [4 /*yield*/, waitFor(el)
                        .toBeVisible()
                        .withTimeout(timeout * 3)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var setLocalAndLoginWithAccessToken = function (accessToken, LL) { return __awaiter(void 0, void 0, void 0, function () {
    var buildBtn, logoutBtn, accessTokenInput, developerScreenSV, envBtn, saveChangesBtn, localInstanceText, balanceHeader;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buildBtn = element(by.id("logo-button"));
                return [4 /*yield*/, waitFor(buildBtn)
                        .toBeVisible()
                        // Wait for 5 mins because metro bundler might not finish sync
                        .withTimeout(5 * 600000)];
            case 1:
                _a.sent();
                return [4 /*yield*/, buildBtn.multiTap(5)];
            case 2:
                _a.sent();
                logoutBtn = element(by.id("logout button"));
                return [4 /*yield*/, waitFor(logoutBtn).toBeVisible().withTimeout(timeout)];
            case 3:
                _a.sent();
                accessTokenInput = element(by.id("Input access token"));
                developerScreenSV = by.id("developer-screen-scroll-view");
                return [4 /*yield*/, waitFor(accessTokenInput)
                        .toBeVisible()
                        .whileElement(developerScreenSV)
                        .scroll(400, "down", NaN, 0.85)];
            case 4:
                _a.sent();
                envBtn = element(by.id("Local Button"));
                return [4 /*yield*/, envBtn.tap()];
            case 5:
                _a.sent();
                return [4 /*yield*/, accessTokenInput.clearText()];
            case 6:
                _a.sent();
                return [4 /*yield*/, accessTokenInput.typeText(accessToken + "\n")];
            case 7:
                _a.sent();
                saveChangesBtn = element(by.id("Save Changes"));
                return [4 /*yield*/, saveChangesBtn.tap()];
            case 8:
                _a.sent();
                localInstanceText = element(by.text("Galoy Instance: Local"));
                return [4 /*yield*/, waitFor(localInstanceText)
                        .toBeVisible()
                        .whileElement(developerScreenSV)
                        .scroll(100, "up", NaN, 0.85)];
            case 9:
                _a.sent();
                return [4 /*yield*/, tap(by.id("Back"))
                    // Sometimes prompt to save password to keychain appears which need to be dismissed
                ];
            case 10:
                _a.sent();
                // Sometimes prompt to save password to keychain appears which need to be dismissed
                return [4 /*yield*/, device.sendToHome()];
            case 11:
                // Sometimes prompt to save password to keychain appears which need to be dismissed
                _a.sent();
                return [4 /*yield*/, device.launchApp({ newInstance: false })];
            case 12:
                _a.sent();
                return [4 /*yield*/, tap(by.id(LL.GetStartedScreen.exploreWallet()))];
            case 13:
                _a.sent();
                balanceHeader = element(by.id("balance-header"));
                return [4 /*yield*/, waitFor(balanceHeader)
                        .toBeVisible()
                        .withTimeout(timeout * 3)];
            case 14:
                _a.sent();
                return [4 /*yield*/, device.setURLBlacklist([".*127.0.0.1.*", ".*localhost.*"])];
            case 15:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=common-flows.js.map