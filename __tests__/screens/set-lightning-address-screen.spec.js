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
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native";
import { SetLightningAddressScreen } from "@app/screens/lightning-address-screen/set-lightning-address-screen";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { ContextForScreen } from "./helper";
var mockRoute = {
    key: "set-address",
    name: "setLightningAddress",
    params: { onboarding: true },
};
describe("SetLightningAddressScreen", function () {
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("Renders screen texts", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.SetAddressModal.receiveMoney({ bankName: "Blink" }))).toBeTruthy();
                            expect(screen.getByText(LL.SetAddressModal.itCannotBeChanged())).toBeTruthy();
                            expect(screen.getByText(LL.SetAddressModal.setLightningAddress())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Shows error when lightning address is too short", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "ab");
                    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()));
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.SetAddressModal.Errors.tooShort())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Shows error when lightning address is invalid", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "invalid!@#");
                    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()));
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.SetAddressModal.Errors.invalidCharacter())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Disables button when input is empty", function () {
        render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
        var button = screen.getByText(LL.SetAddressModal.setLightningAddress());
        expect(button).toBeDisabled();
    });
    it("Shows error when lightning address is too long", function () { return __awaiter(void 0, void 0, void 0, function () {
        var longAddress;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
                    longAddress = "a".repeat(51);
                    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), longAddress);
                    fireEvent.press(screen.getByText(LL.SetAddressModal.setLightningAddress()));
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.SetAddressModal.Errors.tooLong())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Does not show error when lightning address is valid (no submit)", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <SetLightningAddressScreen route={mockRoute}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByPlaceholderText("SatoshiNakamoto"), "validusername");
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.queryByText(LL.SetAddressModal.Errors.invalidCharacter())).toBeNull();
                            expect(screen.queryByText(LL.SetAddressModal.Errors.tooShort())).toBeNull();
                            expect(screen.queryByText(LL.SetAddressModal.Errors.tooLong())).toBeNull();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=set-lightning-address-screen.spec.js.map