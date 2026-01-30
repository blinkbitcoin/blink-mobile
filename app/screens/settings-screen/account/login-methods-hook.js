import { useSettingsScreenQuery } from "@app/graphql/generated";
export var useLoginMethods = function () {
    var _a, _b, _c, _d, _e;
    var data = useSettingsScreenQuery({ fetchPolicy: "cache-and-network" }).data;
    var email = ((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.address) || undefined;
    var emailVerified = Boolean(email && ((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.email) === null || _d === void 0 ? void 0 : _d.verified));
    var phone = (_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.phone;
    var phoneVerified = Boolean(phone);
    var bothEmailAndPhoneVerified = phoneVerified && emailVerified;
    return {
        loading: !data, // Data would auto refresh after network call
        email: email,
        emailVerified: emailVerified,
        phone: phone,
        phoneVerified: phoneVerified,
        bothEmailAndPhoneVerified: bothEmailAndPhoneVerified,
    };
};
//# sourceMappingURL=login-methods-hook.js.map