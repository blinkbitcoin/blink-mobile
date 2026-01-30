export var SetUsernameError = {
    TOO_SHORT: "TOO_SHORT",
    TOO_LONG: "TOO_LONG",
    INVALID_CHARACTER: "INVALID_CHARACTER",
    ADDRESS_UNAVAILABLE: "ADDRESS_UNAVAILABLE",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
};
var UsernameRegex = /^(?![13_]|bc1|lnbc1)(?=.*[a-z])[0-9a-z_]{3,50}$/i;
export var validateUsername = function (username) {
    if (username.length < 3) {
        return {
            valid: false,
            error: SetUsernameError.TOO_SHORT,
        };
    }
    if (username.length > 50) {
        return {
            valid: false,
            error: SetUsernameError.TOO_LONG,
        };
    }
    if (!UsernameRegex.test(username)) {
        return {
            valid: false,
            error: SetUsernameError.INVALID_CHARACTER,
        };
    }
    return { valid: true };
};
//# sourceMappingURL=username-validation.js.map