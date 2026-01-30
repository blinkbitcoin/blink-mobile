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
var _a;
import axios, { isAxiosError } from "axios";
import parsePhoneNumber, { AsYouType, getCountryCallingCode, } from "libphonenumber-js/mobile";
import { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { PhoneCodeChannelType, useCaptchaRequestAuthCodeMutation, useSupportedCountriesQuery, } from "@app/graphql/generated";
import { useAppConfig, useGeetestCaptcha } from "@app/hooks";
import useDeviceLocation from "@app/hooks/use-device-location";
import { logRequestAuthCode } from "@app/utils/analytics";
import { isIos } from "@app/utils/helper";
import useAppCheckToken from "../get-started-screen/use-device-token";
export var RequestPhoneCodeStatus = {
    LoadingCountryCode: "LoadingCountryCode",
    InputtingPhoneNumber: "InputtingPhoneNumber",
    CompletingCaptchaOrAppcheck: "CompletingCaptchaOrAppcheck",
    RequestingCode: "RequestingCode",
    SuccessRequestingCode: "SuccessRequestingCode",
    Error: "Error",
};
export var ErrorType = {
    InvalidPhoneNumberError: "InvalidPhoneNumberError",
    FailedCaptchaError: "FailedCaptchaError",
    TooManyAttemptsError: "TooManyAttemptsError",
    RequestCodeError: "RequestCodeError",
    UnsupportedCountryError: "UnsupportedCountryError",
};
export var PhoneCodeChannelToFriendlyName = (_a = {},
    _a[PhoneCodeChannelType.Sms] = "SMS",
    _a[PhoneCodeChannelType.Whatsapp] = "WhatsApp",
    _a[PhoneCodeChannelType.Telegram] = "Telegram",
    _a);
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation captchaRequestAuthCode($input: CaptchaRequestAuthCodeInput!) {\n    captchaRequestAuthCode(input: $input) {\n      errors {\n        message\n        code\n      }\n      success\n    }\n  }\n\n  query supportedCountries {\n    globals {\n      supportedCountries {\n        id\n        supportedAuthChannels\n      }\n    }\n  }\n"], ["\n  mutation captchaRequestAuthCode($input: CaptchaRequestAuthCodeInput!) {\n    captchaRequestAuthCode(input: $input) {\n      errors {\n        message\n        code\n      }\n      success\n    }\n  }\n\n  query supportedCountries {\n    globals {\n      supportedCountries {\n        id\n        supportedAuthChannels\n      }\n    }\n  }\n"])));
export var useRequestPhoneCodeLogin = function () {
    var _a = useState(RequestPhoneCodeStatus.LoadingCountryCode), status = _a[0], setStatus = _a[1];
    var _b = useState(), countryCode = _b[0], setCountryCode = _b[1];
    var _c = useState(""), rawPhoneNumber = _c[0], setRawPhoneNumber = _c[1];
    var _d = useState(), validatedPhoneNumber = _d[0], setValidatedPhoneNumber = _d[1];
    var _e = useState(PhoneCodeChannelType.Sms), phoneCodeChannel = _e[0], setPhoneCodeChannel = _e[1];
    var authUrl = useAppConfig().appConfig.galoyInstance.authUrl;
    var appConfig = useAppConfig().appConfig;
    var _f = useState(), error = _f[0], setError = _f[1];
    var captchaRequestAuthCode = useCaptchaRequestAuthCodeMutation()[0];
    var _g = useSupportedCountriesQuery(), data = _g.data, loadingSupportedCountries = _g.loading;
    var _h = useDeviceLocation(), detectedCountryCode = _h.countryCode, loadingDetectedCountryCode = _h.loading;
    var appCheckToken = useAppCheckToken({});
    var _j = useGeetestCaptcha(), geetestError = _j.geetestError, geetestValidationData = _j.geetestValidationData, loadingRegisterCaptcha = _j.loadingRegisterCaptcha, registerCaptcha = _j.registerCaptcha, resetError = _j.resetError, resetValidationData = _j.resetValidationData;
    var _k = useMemo(function () {
        var _a, _b;
        var currentCountry = (_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.supportedCountries.find(function (country) { return country.id === countryCode; });
        var allSupportedCountries = (((_b = data === null || data === void 0 ? void 0 : data.globals) === null || _b === void 0 ? void 0 : _b.supportedCountries.map(function (country) { return country.id; })) || []);
        var isTelegramSupported = !isIos &&
            ((currentCountry === null || currentCountry === void 0 ? void 0 : currentCountry.supportedAuthChannels.includes(PhoneCodeChannelType.Telegram)) ||
                false);
        var isWhatsAppSupported = (currentCountry === null || currentCountry === void 0 ? void 0 : currentCountry.supportedAuthChannels.includes(PhoneCodeChannelType.Whatsapp)) ||
            false;
        var isSmsSupported = (currentCountry === null || currentCountry === void 0 ? void 0 : currentCountry.supportedAuthChannels.includes(PhoneCodeChannelType.Sms)) || false;
        return {
            isTelegramSupported: isTelegramSupported,
            isWhatsAppSupported: isWhatsAppSupported,
            isSmsSupported: isSmsSupported,
            allSupportedCountries: allSupportedCountries,
        };
    }, [data === null || data === void 0 ? void 0 : data.globals, countryCode]), isTelegramSupported = _k.isTelegramSupported, isWhatsAppSupported = _k.isWhatsAppSupported, isSmsSupported = _k.isSmsSupported, allSupportedCountries = _k.allSupportedCountries;
    // setting default country code from IP
    useEffect(function () {
        if (detectedCountryCode) {
            setCountryCode(detectedCountryCode);
            setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber);
        }
    }, [detectedCountryCode]);
    // when phone number is submitted and either captcha is requested, or appcheck is used
    useEffect(function () {
        if (status !== RequestPhoneCodeStatus.CompletingCaptchaOrAppcheck) {
            return;
        }
        var captchaPath = function () { return __awaiter(void 0, void 0, void 0, function () {
            var input, data_1, errors, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (geetestError) {
                            setStatus(RequestPhoneCodeStatus.Error);
                            setError(ErrorType.FailedCaptchaError);
                            resetError();
                            return [2 /*return*/];
                        }
                        if (!(geetestValidationData && validatedPhoneNumber)) return [3 /*break*/, 5];
                        setStatus(RequestPhoneCodeStatus.RequestingCode);
                        input = {
                            phone: validatedPhoneNumber,
                            challengeCode: geetestValidationData.geetestChallenge,
                            validationCode: geetestValidationData.geetestValidate,
                            secCode: geetestValidationData.geetestSecCode,
                            channel: phoneCodeChannel,
                        };
                        resetValidationData();
                        logRequestAuthCode({
                            instance: appConfig.galoyInstance.id,
                            channel: phoneCodeChannel,
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, captchaRequestAuthCode({ variables: { input: input } })];
                    case 2:
                        data_1 = (_a.sent()).data;
                        if (data_1 === null || data_1 === void 0 ? void 0 : data_1.captchaRequestAuthCode.success) {
                            setStatus(RequestPhoneCodeStatus.SuccessRequestingCode);
                            return [2 /*return*/];
                        }
                        setStatus(RequestPhoneCodeStatus.Error);
                        errors = data_1 === null || data_1 === void 0 ? void 0 : data_1.captchaRequestAuthCode.errors;
                        if (errors && errors.some(function (error) { return error.code === "TOO_MANY_REQUEST"; })) {
                            console.log("Too many attempts");
                            setError(ErrorType.TooManyAttemptsError);
                        }
                        else {
                            setError(ErrorType.RequestCodeError);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        setStatus(RequestPhoneCodeStatus.Error);
                        setError(ErrorType.RequestCodeError);
                        return [3 /*break*/, 4];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        // we first register captcha, which will set geetestValidationData
                        registerCaptcha();
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        var appCheckPath = function () { return __awaiter(void 0, void 0, void 0, function () {
            var err_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.post(authUrl + "/auth/phone/code-appcheck", {
                                phone: validatedPhoneNumber,
                                channel: phoneCodeChannel,
                            }, {
                                headers: {
                                    Appcheck: appCheckToken,
                                },
                            })];
                    case 1:
                        _b.sent();
                        setStatus(RequestPhoneCodeStatus.SuccessRequestingCode);
                        return [3 /*break*/, 3];
                    case 2:
                        err_2 = _b.sent();
                        setStatus(RequestPhoneCodeStatus.Error);
                        if (isAxiosError(err_2) &&
                            ((_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data.error) === "UserCodeAttemptIdentifierRateLimiterExceededError") {
                            setError(ErrorType.TooManyAttemptsError);
                        }
                        else {
                            setError(ErrorType.RequestCodeError);
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        var skipRequestPhoneCode = appConfig.galoyInstance.name === "Local" ||
            appConfig.galoyInstance.name === "Staging";
        if (skipRequestPhoneCode) {
            setStatus(RequestPhoneCodeStatus.SuccessRequestingCode);
        }
        else if (appCheckToken) {
            appCheckPath();
        }
        else {
            captchaPath();
        }
    }, [
        status,
        geetestValidationData,
        validatedPhoneNumber,
        appConfig,
        captchaRequestAuthCode,
        geetestError,
        phoneCodeChannel,
        resetError,
        resetValidationData,
        registerCaptcha,
        appCheckToken,
        authUrl,
    ]);
    var setPhoneNumber = function (number) {
        if (status === RequestPhoneCodeStatus.RequestingCode) {
            return;
        }
        var parsedPhoneNumber = parsePhoneNumber(number, countryCode);
        if (parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.country) {
            setCountryCode(parsedPhoneNumber.country);
        }
        setRawPhoneNumber(number);
        setError(undefined);
        setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber);
    };
    var userSubmitPhoneNumber = function (phoneCodeChannel) {
        if (status === RequestPhoneCodeStatus.LoadingCountryCode ||
            status === RequestPhoneCodeStatus.RequestingCode) {
            return;
        }
        var parsedPhoneNumber = parsePhoneNumber(rawPhoneNumber, countryCode);
        phoneCodeChannel && setPhoneCodeChannel(phoneCodeChannel);
        if (parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.isValid()) {
            if (!parsedPhoneNumber.country ||
                (phoneCodeChannel === PhoneCodeChannelType.Sms && !isSmsSupported) ||
                (phoneCodeChannel === PhoneCodeChannelType.Whatsapp && !isWhatsAppSupported) ||
                (phoneCodeChannel === PhoneCodeChannelType.Telegram && !isTelegramSupported)) {
                setStatus(RequestPhoneCodeStatus.Error);
                setError(ErrorType.UnsupportedCountryError);
                return;
            }
            setValidatedPhoneNumber(parsedPhoneNumber.number);
            // To Telegram it is not required to request an OTP code.
            if (phoneCodeChannel === PhoneCodeChannelType.Telegram) {
                setStatus(RequestPhoneCodeStatus.SuccessRequestingCode);
                return;
            }
            setStatus(RequestPhoneCodeStatus.CompletingCaptchaOrAppcheck);
        }
        else {
            setStatus(RequestPhoneCodeStatus.Error);
            setError(ErrorType.InvalidPhoneNumberError);
        }
    };
    var phoneInputInfo = undefined;
    if (countryCode) {
        phoneInputInfo = {
            countryCode: countryCode,
            formattedPhoneNumber: new AsYouType(countryCode).input(rawPhoneNumber),
            countryCallingCode: getCountryCallingCode(countryCode),
            rawPhoneNumber: rawPhoneNumber,
        };
    }
    return {
        status: status,
        setStatus: setStatus,
        phoneInputInfo: phoneInputInfo,
        validatedPhoneNumber: validatedPhoneNumber,
        error: error,
        userSubmitPhoneNumber: userSubmitPhoneNumber,
        phoneCodeChannel: phoneCodeChannel,
        isTelegramSupported: isTelegramSupported,
        isWhatsAppSupported: isWhatsAppSupported,
        isSmsSupported: isSmsSupported,
        captchaLoading: loadingRegisterCaptcha,
        setCountryCode: setCountryCode,
        setPhoneNumber: setPhoneNumber,
        supportedCountries: allSupportedCountries,
        loadingSupportedCountries: loadingSupportedCountries || loadingDetectedCountryCode,
    };
};
var templateObject_1;
//# sourceMappingURL=request-phone-code-login.js.map