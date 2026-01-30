export var timeAgo = function (pastDate) {
    var now = new Date();
    var past = new Date(pastDate * 1000);
    var diff = Number(now) - Number(past);
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    if (seconds < 60) {
        return "a few seconds ago";
    }
    else if (minutes < 60) {
        return "".concat(minutes, " minute").concat(minutes > 1 ? "s" : "", " ago");
    }
    else if (hours < 24) {
        return "".concat(hours, " hour").concat(hours > 1 ? "s" : "", " ago");
    }
    return "".concat(days, " day").concat(days > 1 ? "s" : "", " ago");
};
//# sourceMappingURL=utils.js.map