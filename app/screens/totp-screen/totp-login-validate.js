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
import axios, { isAxiosError } from "axios";
import React, { useCallback, useState } from "react";
import { CodeInput } from "@app/components/code-input";
import { useAppConfig, useSaveSessionProfile } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import analytics from "@react-native-firebase/analytics";
import { useNavigation } from "@react-navigation/native";
export var TotpLoginValidateScreen = function (_a) {
    var route = _a.route;
    var navigation = useNavigation();
    var _b = useState(""), errorMessage = _b[0], setErrorMessage = _b[1];
    var saveProfile = useSaveSessionProfile().saveProfile;
    var _c = useState(false), loading = _c[0], setLoading = _c[1];
    var authToken = route.params.authToken;
    var authUrl = useAppConfig().appConfig.galoyInstance.authUrl;
    var LL = useI18nContext().LL;
    var send = useCallback(function (code) { return __awaiter(void 0, void 0, void 0, function () {
        var url, response, success, err_1;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 2, 3, 4]);
                    setLoading(true);
                    url = "".concat(authUrl, "/auth/totp/validate");
                    return [4 /*yield*/, axios({
                            url: url,
                            method: "POST",
                            data: {
                                totpCode: code,
                                authToken: authToken,
                            },
                        })];
                case 1:
                    response = _h.sent();
                    success = response.status === 200;
                    if (success) {
                        analytics().logLogin({
                            method: "email-2fa",
                        });
                        saveProfile(authToken);
                        navigation.reset({
                            routes: [{ name: "Primary" }],
                        });
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 4];
                case 2:
                    err_1 = _h.sent();
                    console.error(err_1, "error axios");
                    if (isAxiosError(err_1)) {
                        console.log(err_1.message); // Gives you the basic error message
                        console.log((_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data); // Gives you the response payload from the server
                        console.log((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.status); // Gives you the HTTP status code
                        console.log((_c = err_1.response) === null || _c === void 0 ? void 0 : _c.headers); // Gives you the response headers
                        // If the request was made but no response was received
                        if (!err_1.response) {
                            console.log(err_1.request);
                        }
                        if ((_e = (_d = err_1.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.error) {
                            setErrorMessage((_g = (_f = err_1.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.error);
                        }
                        else {
                            setErrorMessage(err_1.message);
                        }
                    }
                    return [3 /*break*/, 4];
                case 3:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [authToken, navigation, authUrl, saveProfile]);
    var header = LL.TotpLoginValidateScreen.content();
    return (<CodeInput send={send} header={header} loading={loading} errorMessage={errorMessage} setErrorMessage={setErrorMessage}/>);
};
//# sourceMappingURL=totp-login-validate.js.map