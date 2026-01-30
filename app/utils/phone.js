import parsePhoneNumber, { isValidPhoneNumber, } from "libphonenumber-js/mobile";
export var parseValidPhoneNumber = function (input, countryCode) {
    try {
        var parsed = parsePhoneNumber(input, countryCode);
        if (parsed && parsed.isValid()) {
            return parsed;
        }
    }
    catch (_a) {
        return null;
    }
    return null;
};
export var isPhoneNumber = function (phoneNumber) {
    var _a;
    try {
        if (isValidPhoneNumber(phoneNumber))
            return true;
        var parsed = parsePhoneNumber(phoneNumber);
        return (_a = parsed === null || parsed === void 0 ? void 0 : parsed.isValid()) !== null && _a !== void 0 ? _a : false;
    }
    catch (_b) {
        return false;
    }
};
//# sourceMappingURL=phone.js.map