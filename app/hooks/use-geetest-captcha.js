var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import { useCallback, useEffect, useRef, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";
import { gql } from "@apollo/client";
import { useCaptchaCreateChallengeMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { logStartCaptcha } from "@app/utils/analytics";
import GeetestModule from "@galoymoney/react-native-geetest-module";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation captchaCreateChallenge {\n    captchaCreateChallenge {\n      errors {\n        message\n      }\n      result {\n        id\n        challengeCode\n        newCaptcha\n        failbackMode\n      }\n    }\n  }\n"], ["\n  mutation captchaCreateChallenge {\n    captchaCreateChallenge {\n      errors {\n        message\n      }\n      result {\n        id\n        challengeCode\n        newCaptcha\n        failbackMode\n      }\n    }\n  }\n"])));
export var useGeetestCaptcha = function () {
    var _a = useState(null), geetestValidationData = _a[0], setGeetesValidationData = _a[1];
    var _b = useState(null), error = _b[0], setError = _b[1];
    var LL = useI18nContext().LL;
    var onGeeTestDialogResultListener = useRef();
    var onGeeTestFailedListener = useRef();
    var _c = useCaptchaCreateChallengeMutation({
        fetchPolicy: "no-cache",
    }), captchaCreateChallenge = _c[0], loadingRegisterCaptcha = _c[1].loading;
    var resetValidationData = useCallback(function () { return setGeetesValidationData(null); }, [setGeetesValidationData]);
    var resetError = useCallback(function () { return setError(null); }, [setError]);
    var registerCaptcha = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var data, result, errors, params;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    logStartCaptcha();
                    return [4 /*yield*/, captchaCreateChallenge()];
                case 1:
                    data = (_d.sent()).data;
                    result = (_a = data === null || data === void 0 ? void 0 : data.captchaCreateChallenge) === null || _a === void 0 ? void 0 : _a.result;
                    errors = (_c = (_b = data === null || data === void 0 ? void 0 : data.captchaCreateChallenge) === null || _b === void 0 ? void 0 : _b.errors) !== null && _c !== void 0 ? _c : [];
                    if (errors.length > 0) {
                        setError(errors[0].message);
                    }
                    else if (result) {
                        params = {
                            success: result.failbackMode ? 0 : 1,
                            challenge: result.challengeCode,
                            gt: result.id,
                            // eslint-disable-next-line camelcase
                            new_captcha: result.newCaptcha,
                        };
                        // Test only
                        // TODO: mock whole hook instead?
                        if (
                        // those values are part of the Mocked queriies from apollo MockedProvider
                        // used in storybook
                        result.id === "d5cdc22925d10bc4720d012ba48dd214" &&
                            result.challengeCode === "af073125d936ff9e5aa4c1ed44a38d5d") {
                            setGeetesValidationData({
                                geetestChallenge: "af073125d936ff9e5aa4c1ed44a38d5d4s",
                                geetestSecCode: "290cc148dfb39afb5af63320469facd6",
                                geetestValidate: "290cc148dfb39afb5af63320469facd6|jordan",
                            });
                            return [2 /*return*/];
                        }
                        GeetestModule.handleRegisteredGeeTestCaptcha(JSON.stringify(params));
                    }
                    else {
                        setError(LL.errors.generic());
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [captchaCreateChallenge, LL]);
    useEffect(function () {
        GeetestModule.setUp();
        var eventEmitter = new NativeEventEmitter(NativeModules.GeetestModule);
        onGeeTestDialogResultListener.current = eventEmitter.addListener("GT3-->onDialogResult-->", function (event) {
            // on failed test the result is {"result": "{\"geetest_challenge\":\"\"}"}
            var _a = JSON.parse(event.result), geetestChallenge = _a.geetest_challenge, geetestSecCode = _a.geetest_seccode, geetestValidate = _a.geetest_validate;
            if (geetestChallenge && geetestSecCode && geetestValidate) {
                setGeetesValidationData({
                    geetestChallenge: geetestChallenge,
                    geetestSecCode: geetestSecCode,
                    geetestValidate: geetestValidate,
                });
            }
        });
        onGeeTestFailedListener.current = eventEmitter.addListener("GT3-->onFailed-->", function (event) {
            setError(event.error);
        });
        return function () {
            GeetestModule.tearDown();
            if (onGeeTestDialogResultListener.current) {
                onGeeTestDialogResultListener.current.remove();
            }
            if (onGeeTestFailedListener.current) {
                onGeeTestFailedListener.current.remove();
            }
        };
    }, []);
    return {
        geetestError: error,
        geetestValidationData: geetestValidationData,
        loadingRegisterCaptcha: loadingRegisterCaptcha,
        registerCaptcha: registerCaptcha,
        resetError: resetError,
        resetValidationData: resetValidationData,
    };
};
var templateObject_1;
//# sourceMappingURL=use-geetest-captcha.js.map