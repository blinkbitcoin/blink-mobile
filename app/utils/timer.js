export function parseTimer(seconds) {
    if (!seconds) {
        return "00:00";
    }
    var minute = parseInt(String(seconds / 60), 10);
    var second = parseInt(String(seconds % 60), 10);
    return "".concat(minute.toString().padStart(2, "0"), ":").concat(second > 0 ? second.toString().padStart(2, "0") : "00");
}
//# sourceMappingURL=timer.js.map