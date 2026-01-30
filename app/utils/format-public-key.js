export var formatPublicKey = function (rawKey) {
    try {
        return JSON.parse("\"".concat(rawKey, "\"")).trim();
    }
    catch (_a) {
        return rawKey.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
    }
};
//# sourceMappingURL=format-public-key.js.map