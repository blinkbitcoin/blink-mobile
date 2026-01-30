import React from "react";
import { Text } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { formatShortDate, isToday, isYesterday } from "@app/utils/date";
export var formatDateForTransaction = function (_a) {
    var createdAt = _a.createdAt, locale = _a.locale, timezone = _a.timezone, _b = _a.now, now = _b === void 0 ? Date.now() : _b, includeTime = _a.includeTime;
    var rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    var diffInSeconds = Math.max(0, Math.floor((now - createdAt * 1000) / 1000));
    if (!includeTime && (isToday(createdAt) || isYesterday(createdAt))) {
        if (diffInSeconds < 60) {
            return rtf.format(-diffInSeconds, "second");
        }
        if (diffInSeconds < 3600) {
            return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
        }
        return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
    }
    if (includeTime) {
        var options = {
            dateStyle: "full",
        };
        // forcing a timezone for the tests
        if (timezone) {
            options.timeZone = timezone;
        }
        if (includeTime) {
            options.timeStyle = "medium";
        }
        return new Date(createdAt * 1000).toLocaleString(locale, options);
    }
    return formatShortDate({ createdAt: createdAt, timezone: timezone });
};
export var TransactionDate = function (_a) {
    var createdAt = _a.createdAt, status = _a.status, includeTime = _a.includeTime;
    var _b = useI18nContext(), LL = _b.LL, locale = _b.locale;
    if (status === "PENDING") {
        return <Text>{LL.common.pending().toUpperCase()}</Text>;
    }
    return <Text>{formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: includeTime })}</Text>;
};
//# sourceMappingURL=transaction-date.js.map