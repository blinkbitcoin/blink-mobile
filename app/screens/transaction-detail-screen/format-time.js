export var formatTimeToMempool = function (timeDiff, LL, userLocale) {
    var rtf = new Intl.RelativeTimeFormat(userLocale, { numeric: "auto" });
    var minutes = Math.floor(timeDiff / 60000);
    var seconds = Math.floor((timeDiff % 60000) / 1000);
    if (minutes > 0) {
        return rtf.format(minutes, "minute");
    }
    else if (seconds > 0) {
        return rtf.format(seconds, "second");
    }
    return LL.TransactionDetailScreen.momentarily();
};
export var timeToMempool = function (arrivalTimestamp) {
    var arrivalTime = new Date(arrivalTimestamp * 1000);
    var currentTime = new Date();
    var timeDiff = Number(arrivalTime) - Number(currentTime);
    timeDiff = Math.max(timeDiff, 0);
    return timeDiff;
};
//# sourceMappingURL=format-time.js.map