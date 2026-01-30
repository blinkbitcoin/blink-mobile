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
import parsePhoneNumber, { AsYouType, getCountryCallingCode, } from "libphonenumber-js/mobile";
import { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { PhoneCodeChannelType, useSupportedCountriesQuery, useUserPhoneRegistrationInitiateMutation, } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import useDeviceLocation from "@app/hooks/use-device-location";
import { useNavigation } from "@react-navigation/native";
export var RequestPhoneCodeStatus = {
    LoadingCountryCode: "LoadingCountryCode",
    InputtingPhoneNumber: "InputtingPhoneNumber",
    RequestingCode: "RequestingCode",
    SuccessRequestingCode: "SuccessRequestingCode",
    Error: "Error",
};
export var ErrorType = {
    InvalidPhoneNumberError: "InvalidPhoneNumberError",
    TooManyAttemptsError: "TooManyAttemptsError",
    RequestCodeError: "RequestCodeError",
    UnsupportedCountryError: "UnsupportedCountryError",
};
export var PhoneCodeChannelToFriendlyName = (_a = {},
    _a[PhoneCodeChannelType.Sms] = "SMS",
    _a[PhoneCodeChannelType.Whatsapp] = "WhatsApp",
    _a);
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userPhoneRegistrationInitiate($input: UserPhoneRegistrationInitiateInput!) {\n    userPhoneRegistrationInitiate(input: $input) {\n      errors {\n        message\n      }\n      success\n    }\n  }\n"], ["\n  mutation userPhoneRegistrationInitiate($input: UserPhoneRegistrationInitiateInput!) {\n    userPhoneRegistrationInitiate(input: $input) {\n      errors {\n        message\n      }\n      success\n    }\n  }\n"])));
export var useRequestPhoneCodeRegistration = function () {
    var _a = useState(RequestPhoneCodeStatus.LoadingCountryCode), status = _a[0], setStatus = _a[1];
    var _b = useState(), countryCode = _b[0], setCountryCode = _b[1];
    var _c = useState(""), rawPhoneNumber = _c[0], setRawPhoneNumber = _c[1];
    var _d = useState(), validatedPhoneNumber = _d[0], setValidatedPhoneNumber = _d[1];
    var _e = useState(PhoneCodeChannelType.Sms), phoneCodeChannel = _e[0], setPhoneCodeChannel = _e[1];
    var appConfig = useAppConfig().appConfig;
    var skipRequestPhoneCode = appConfig.galoyInstance.name === "Local";
    var registerPhone = useUserPhoneRegistrationInitiateMutation()[0];
    var _f = useState(), error = _f[0], setError = _f[1];
    var navigation = useNavigation();
    var data = useSupportedCountriesQuery().data;
    var detectedCountryCode = useDeviceLocation().countryCode;
    var _g = useMemo(function () {
        var _a, _b;
        var currentCountry = (_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.supportedCountries.find(function (country) { return country.id === countryCode; });
        var allSupportedCountries = (((_b = data === null || data === void 0 ? void 0 : data.globals) === null || _b === void 0 ? void 0 : _b.supportedCountries.map(function (country) { return country.id; })) || []);
        var isWhatsAppSupported = (currentCountry === null || currentCountry === void 0 ? void 0 : currentCountry.supportedAuthChannels.includes(PhoneCodeChannelType.Whatsapp)) ||
            false;
        var isSmsSupported = (currentCountry === null || currentCountry === void 0 ? void 0 : currentCountry.supportedAuthChannels.includes(PhoneCodeChannelType.Sms)) || false;
        return {
            isWhatsAppSupported: isWhatsAppSupported,
            isSmsSupported: isSmsSupported,
            allSupportedCountries: allSupportedCountries,
        };
    }, [data === null || data === void 0 ? void 0 : data.globals, countryCode]), isWhatsAppSupported = _g.isWhatsAppSupported, isSmsSupported = _g.isSmsSupported, allSupportedCountries = _g.allSupportedCountries;
    // setting default country code from IP
    useEffect(function () {
        if (detectedCountryCode) {
            setCountryCode(detectedCountryCode);
            setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber);
        }
    }, [detectedCountryCode]);
    var setPhoneNumber = function (number) {
        if (status === RequestPhoneCodeStatus.RequestingCode) {
            return;
        }
        // handle paste
        if (number.length - rawPhoneNumber.length > 1) {
            var parsedPhoneNumber = parsePhoneNumber(number, countryCode);
            if (parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.isValid()) {
                parsedPhoneNumber.country && setCountryCode(parsedPhoneNumber.country);
            }
        }
        setRawPhoneNumber(number);
        setError(undefined);
        setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber);
    };
    var userSubmitPhoneNumber = function (phoneCodeChannel) { return __awaiter(void 0, void 0, void 0, function () {
        var parsedPhoneNumber, res, error_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (status === RequestPhoneCodeStatus.LoadingCountryCode ||
                        status === RequestPhoneCodeStatus.RequestingCode) {
                        return [2 /*return*/];
                    }
                    parsedPhoneNumber = parsePhoneNumber(rawPhoneNumber, countryCode);
                    phoneCodeChannel && setPhoneCodeChannel(phoneCodeChannel);
                    if (!(parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.isValid())) return [3 /*break*/, 5];
                    if (!parsedPhoneNumber.country ||
                        (phoneCodeChannel === PhoneCodeChannelType.Sms && !isSmsSupported) ||
                        (phoneCodeChannel === PhoneCodeChannelType.Whatsapp && !isWhatsAppSupported)) {
                        setStatus(RequestPhoneCodeStatus.Error);
                        setError(ErrorType.UnsupportedCountryError);
                        return [2 /*return*/];
                    }
                    setValidatedPhoneNumber(parsedPhoneNumber.number);
                    if (skipRequestPhoneCode) {
                        navigation.navigate("phoneRegistrationValidate", {
                            phone: parsedPhoneNumber.number,
                            channel: phoneCodeChannel,
                        });
                        return [2 /*return*/];
                    }
                    setStatus(RequestPhoneCodeStatus.RequestingCode);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, registerPhone({
                            variables: {
                                input: { phone: parsedPhoneNumber.number, channel: phoneCodeChannel },
                            },
                        })];
                case 2:
                    res = _d.sent();
                    if ((_c = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.userPhoneRegistrationInitiate) === null || _b === void 0 ? void 0 : _b.errors) === null || _c === void 0 ? void 0 : _c.length) {
                        setStatus(RequestPhoneCodeStatus.Error);
                        // TODO: show error message
                        setError(ErrorType.RequestCodeError);
                    }
                    else {
                        setStatus(RequestPhoneCodeStatus.SuccessRequestingCode);
                        navigation.navigate("phoneRegistrationValidate", {
                            phone: parsedPhoneNumber.number,
                            channel: phoneCodeChannel,
                        });
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _d.sent();
                    console.error(error_1);
                    setStatus(RequestPhoneCodeStatus.Error);
                    setError(ErrorType.RequestCodeError);
                    return [3 /*break*/, 4];
                case 4: return [3 /*break*/, 6];
                case 5:
                    setStatus(RequestPhoneCodeStatus.Error);
                    setError(ErrorType.InvalidPhoneNumberError);
                    _d.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    }); };
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
        isWhatsAppSupported: isWhatsAppSupported,
        isSmsSupported: isSmsSupported,
        setCountryCode: setCountryCode,
        setPhoneNumber: setPhoneNumber,
        supportedCountries: allSupportedCountries,
    };
};
var templateObject_1;
//# sourceMappingURL=request-phone-code-registration.js.map