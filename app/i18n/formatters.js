export var initFormatters = function (_locale) {
    var formatters = {
        sats: function (value) {
            if (!value)
                return "0 sats";
            var amount = Number(value);
            if (isNaN(amount))
                return "0 sats";
            if (amount === 1)
                return "1 sat";
            return "".concat(amount, " sats");
        },
    };
    return formatters;
};
//# sourceMappingURL=formatters.js.map