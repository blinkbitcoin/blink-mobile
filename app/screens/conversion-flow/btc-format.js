export var BTC_SUFFIX = "SAT";
export var formatBtcWithSuffix = function (digits) {
    if (!digits)
        return "";
    return "".concat(digits, " ").concat(BTC_SUFFIX);
};
export var findBtcSuffixIndex = function (value) {
    var idx = value.toUpperCase().indexOf(" ".concat(BTC_SUFFIX));
    return idx >= 0 ? idx : value.length;
};
//# sourceMappingURL=btc-format.js.map