/* eslint-disable no-param-reassign */
export var DEC_1_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2023, 11, 1, 6, 0, 0)).getTime();
export var JAN_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 0, 1, 6, 0, 0)).getTime();
export var FEB_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 1, 1, 6, 0, 0)).getTime();
export var MAR_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 2, 1, 6, 0, 0)).getTime();
export var APR_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 3, 1, 6, 0, 0)).getTime();
export var MAY_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 4, 1, 6, 0, 0)).getTime();
export var JUNE_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 5, 1, 6, 0, 0)).getTime();
export var JULY_1_2024_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2024, 6, 1, 6, 0, 0)).getTime();
var secondsToDDMMSS = function (totalSeconds) {
    if (totalSeconds < 0)
        return "";
    var days = Math.floor(totalSeconds / 86400); // There are 86400 seconds in a day
    var hours = Math.floor((totalSeconds - days * 86400) / 3600); // 3600 seconds in an hour
    var minutes = Math.floor((totalSeconds - days * 86400 - hours * 3600) / 60);
    var seconds = Math.floor(totalSeconds - days * 86400 - hours * 3600 - minutes * 60);
    var formattedDays = days.toString().padStart(2, "0");
    var formattedHours = hours.toString().padStart(2, "0");
    var formattedMinutes = minutes.toString().padStart(2, "0");
    var formattedSeconds = seconds.toString().padStart(2, "0");
    return "".concat(formattedDays, ":").concat(formattedHours, ":").concat(formattedMinutes, ":").concat(formattedSeconds);
};
export var getTimeLeft = function (_a) {
    var after = _a.after, until = _a.until;
    var dateNow = Date.now();
    if (dateNow > until || dateNow < after)
        return "";
    var sLeft = (until - dateNow) / 1000;
    return secondsToDDMMSS(sLeft);
};
// e.g. 1747691078 -> "2025-05-19 15:44"
export function formatUnixTimestampYMDHM(timestampInSeconds) {
    return new Date(timestampInSeconds * 1000).toISOString().slice(0, 16).replace("T", " ");
}
export var isSameDay = function (a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
};
export var isToday = function (createdAt) {
    return isSameDay(new Date(createdAt * 1000), new Date());
};
export var isYesterday = function (createdAt) {
    return isSameDay(new Date(createdAt * 1000), new Date(Date.now() - 86400000));
};
export var formatShortDate = function (_a) {
    var createdAt = _a.createdAt, timezone = _a.timezone;
    var options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
    };
    return new Date(createdAt * 1000).toLocaleDateString("en-CA", options);
};
//# sourceMappingURL=date.js.map