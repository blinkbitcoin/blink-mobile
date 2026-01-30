import { TxDirection, TxStatus } from "./generated";
var getUserTimezoneDate = function (date) {
    var userTimezoneOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(date.getTime() - userTimezoneOffset);
};
var sameDay = function (d1, d2) {
    var date1 = getUserTimezoneDate(new Date(1000 * d1));
    var date2;
    if (typeof d2 === "number") {
        date2 = getUserTimezoneDate(new Date(d2));
    }
    else {
        date2 = getUserTimezoneDate(d2);
    }
    return (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate());
};
var formatDateByMonthYear = function (locale, date) {
    var parsedDate = typeof date === "number" ? new Date(1000 * date) : new Date(date);
    return parsedDate.toLocaleString(locale, { month: "long", year: "numeric" }); // e.g., "November 2023"
};
var isToday = function (tx) { return sameDay(tx.createdAt, new Date()); };
var isYesterday = function (tx) {
    return sameDay(tx.createdAt, new Date().setDate(new Date().getDate() - 1));
};
export var groupTransactionsByDate = function (_a) {
    var pendingIncomingTxs = _a.pendingIncomingTxs, txs = _a.txs, LL = _a.LL, locale = _a.locale;
    var sections = [];
    var settledOrOutgoingTransactions = txs.filter(function (tx) { return tx.status !== TxStatus.Pending || tx.direction === TxDirection.Send; });
    var transactionsByRelativeDate = {};
    for (var _i = 0, _b = pendingIncomingTxs !== null && pendingIncomingTxs !== void 0 ? pendingIncomingTxs : []; _i < _b.length; _i++) {
        var tx = _b[_i];
        if (!transactionsByRelativeDate[LL.common.today()]) {
            transactionsByRelativeDate[LL.common.today()] = [];
        }
        transactionsByRelativeDate[LL.common.today()].push(tx);
    }
    for (var _c = 0, settledOrOutgoingTransactions_1 = settledOrOutgoingTransactions; _c < settledOrOutgoingTransactions_1.length; _c++) {
        var tx = settledOrOutgoingTransactions_1[_c];
        var dateString = void 0;
        if (isToday(tx)) {
            dateString = LL.common.today();
        }
        else if (isYesterday(tx)) {
            dateString = LL.common.yesterday();
        }
        else {
            dateString = formatDateByMonthYear(locale, tx.createdAt);
        }
        if (!transactionsByRelativeDate[dateString]) {
            transactionsByRelativeDate[dateString] = [];
        }
        transactionsByRelativeDate[dateString].push(tx);
    }
    Object.keys(transactionsByRelativeDate).forEach(function (key) {
        sections.push({ title: key, data: transactionsByRelativeDate[key] });
    });
    return sections;
};
//# sourceMappingURL=transactions.js.map