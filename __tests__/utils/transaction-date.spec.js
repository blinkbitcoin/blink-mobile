var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { formatDateForTransaction } from "@app/components/transaction-date";
import * as dateUtils from "@app/utils/date";
jest.mock("@app/utils/date", function () { return (__assign(__assign({}, jest.requireActual("@app/utils/date")), { isToday: jest.fn(), isYesterday: jest.fn() })); });
var mockedIsToday = dateUtils.isToday;
var mockedIsYesterday = dateUtils.isYesterday;
describe("formatDateForTransaction", function () {
    beforeEach(function () {
        mockedIsToday.mockReset();
        mockedIsYesterday.mockReset();
    });
    it("should return short date format for older transactions", function () {
        mockedIsToday.mockReturnValue(false);
        mockedIsYesterday.mockReturnValue(false);
        var createdAt = 1620849600;
        var timezone = "America/El_Salvador";
        var locale = "en";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, timezone: timezone, includeTime: false })).toEqual("2021-05-12");
    });
    it("should return short date format regardless of language", function () {
        mockedIsToday.mockReturnValue(false);
        mockedIsYesterday.mockReturnValue(false);
        var createdAt = 1620849600;
        var locale = "es";
        var timezone = "America/El_Salvador";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, timezone: timezone, includeTime: false })).toEqual("2021-05-12");
    });
    it("if tx is from 2h ago and is today, use relative time instead", function () {
        mockedIsToday.mockReturnValue(true);
        mockedIsYesterday.mockReturnValue(false);
        var createdAt = 1620849600;
        var now = (1620849600 + 60 * 60 * 2) * 1000;
        var locale = "es";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: false, now: now })).toEqual("hace 2 horas");
    });
    it("if tx is from 5 seconds ago and is today, use relative time instead", function () {
        mockedIsToday.mockReturnValue(true);
        mockedIsYesterday.mockReturnValue(false);
        var createdAt = 1620849600;
        var now = (1620849600 + 5) * 1000;
        var locale = "en";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: false, now: now })).toEqual("5 seconds ago");
    });
    it("if tx is from yesterday, use hours instead of day", function () {
        mockedIsToday.mockReturnValue(false);
        mockedIsYesterday.mockReturnValue(true);
        var createdAt = 1620849600;
        var now = (1620849600 + 60 * 60 * 26) * 1000;
        var locale = "en";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: false, now: now })).toEqual("26 hours ago");
    });
    it("if tx is from yesterday and under a minute, use seconds", function () {
        mockedIsToday.mockReturnValue(false);
        mockedIsYesterday.mockReturnValue(true);
        var createdAt = 1620849600;
        var now = (1620849600 + 30) * 1000;
        var locale = "en";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: false, now: now })).toEqual("30 seconds ago");
    });
    it("if tx is from yesterday and under an hour, use minutes", function () {
        mockedIsToday.mockReturnValue(false);
        mockedIsYesterday.mockReturnValue(true);
        var createdAt = 1620849600;
        var now = (1620849600 + 60 * 25) * 1000;
        var locale = "en";
        expect(formatDateForTransaction({ createdAt: createdAt, locale: locale, includeTime: false, now: now })).toEqual("25 minutes ago");
    });
});
//# sourceMappingURL=transaction-date.spec.js.map