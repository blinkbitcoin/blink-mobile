import { it } from "@jest/globals";
import { formatShortDate, isSameDay, isToday, isYesterday } from "@app/utils/date";
describe("date utils", function () {
    describe("isSameDay", function () {
        it.each([
            {
                name: "same calendar day",
                first: new Date(2024, 0, 15, 1, 0, 0),
                second: new Date(2024, 0, 15, 23, 59, 59),
                expected: true,
            },
            {
                name: "different days",
                first: new Date(2024, 0, 15, 23, 59, 59),
                second: new Date(2024, 0, 16, 0, 0, 0),
                expected: false,
            },
            {
                name: "different months",
                first: new Date(2024, 0, 31, 12, 0, 0),
                second: new Date(2024, 1, 1, 12, 0, 0),
                expected: false,
            },
            {
                name: "different years",
                first: new Date(2023, 11, 31, 12, 0, 0),
                second: new Date(2024, 11, 31, 12, 0, 0),
                expected: false,
            },
            {
                name: "midnight vs end of day",
                first: new Date(2024, 5, 10, 0, 0, 0),
                second: new Date(2024, 5, 10, 23, 59, 59),
                expected: true,
            },
            {
                name: "same month different day",
                first: new Date(2024, 5, 10, 12, 0, 0),
                second: new Date(2024, 5, 11, 12, 0, 0),
                expected: false,
            },
            {
                name: "leap day matches",
                first: new Date(2024, 1, 29, 8, 30, 0),
                second: new Date(2024, 1, 29, 22, 15, 0),
                expected: true,
            },
            {
                name: "leap day vs next day",
                first: new Date(2024, 1, 29, 23, 59, 59),
                second: new Date(2024, 2, 1, 0, 0, 0),
                expected: false,
            },
        ])("returns $expected when $name", function (_a) {
            var first = _a.first, second = _a.second, expected = _a.expected;
            expect(isSameDay(first, second)).toBe(expected);
        });
    });
    describe("isToday/isYesterday", function () {
        beforeEach(function () {
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
        });
        afterEach(function () {
            jest.useRealTimers();
        });
        it.each([
            {
                name: "today timestamp returns true",
                value: function () { return Math.floor(Date.now() / 1000); },
                fn: isToday,
                expected: true,
            },
            {
                name: "yesterday timestamp returns false for today",
                value: function () { return Math.floor((Date.now() - 86400000) / 1000); },
                fn: isToday,
                expected: false,
            },
            {
                name: "yesterday timestamp returns true",
                value: function () { return Math.floor((Date.now() - 86400000) / 1000); },
                fn: isYesterday,
                expected: true,
            },
            {
                name: "today timestamp returns false for yesterday",
                value: function () { return Math.floor(Date.now() / 1000); },
                fn: isYesterday,
                expected: false,
            },
            {
                name: "two days ago returns false for today",
                value: function () { return Math.floor((Date.now() - 2 * 86400000) / 1000); },
                fn: isToday,
                expected: false,
            },
            {
                name: "two days ago returns false for yesterday",
                value: function () { return Math.floor((Date.now() - 2 * 86400000) / 1000); },
                fn: isYesterday,
                expected: false,
            },
            {
                name: "near-midnight today",
                before: function () { return jest.setSystemTime(new Date("2024-01-15T00:05:00Z")); },
                value: function () { return Math.floor(Date.parse("2024-01-15T00:00:00Z") / 1000); },
                fn: isToday,
                expected: true,
            },
            {
                name: "near-midnight yesterday",
                before: function () { return jest.setSystemTime(new Date("2024-01-15T00:05:00Z")); },
                value: function () { return Math.floor(Date.parse("2024-01-14T00:01:00Z") / 1000); },
                fn: isYesterday,
                expected: true,
            },
            {
                name: "just after midnight is not yesterday",
                before: function () { return jest.setSystemTime(new Date("2024-01-15T00:01:00Z")); },
                value: function () { return Math.floor(Date.parse("2024-01-15T00:00:30Z") / 1000); },
                fn: isYesterday,
                expected: false,
            },
        ])("returns $expected when $name", function (_a) {
            var before = _a.before, value = _a.value, fn = _a.fn, expected = _a.expected;
            if (before) {
                before();
            }
            expect(fn(value())).toBe(expected);
        });
    });
    describe("formatShortDate", function () {
        it.each([
            {
                name: "formats YYYY-MM-DD in UTC",
                createdAt: Math.floor(Date.parse("2026-01-20T05:00:00Z") / 1000),
                timezone: "UTC",
                expected: "2026-01-20",
            },
            {
                name: "uses leading zeros for month and day",
                createdAt: Math.floor(Date.parse("2024-03-05T12:00:00Z") / 1000),
                timezone: "UTC",
                expected: "2024-03-05",
            },
            {
                name: "rolls back a day for negative timezone offset",
                createdAt: Math.floor(Date.parse("2024-01-01T00:00:00Z") / 1000),
                timezone: "America/Los_Angeles",
                expected: "2023-12-31",
            },
            {
                name: "stays same day for positive timezone offset",
                createdAt: Math.floor(Date.parse("2024-01-01T00:00:00Z") / 1000),
                timezone: "Asia/Tokyo",
                expected: "2024-01-01",
            },
            {
                name: "end of month date",
                createdAt: Math.floor(Date.parse("2024-08-31T23:00:00Z") / 1000),
                timezone: "UTC",
                expected: "2024-08-31",
            },
            {
                name: "leap day formats correctly",
                createdAt: Math.floor(Date.parse("2024-02-29T12:00:00Z") / 1000),
                timezone: "UTC",
                expected: "2024-02-29",
            },
        ])("returns $expected when $name", function (_a) {
            var createdAt = _a.createdAt, timezone = _a.timezone, expected = _a.expected;
            expect(formatShortDate({ createdAt: createdAt, timezone: timezone })).toBe(expected);
        });
        it("defaults to local timezone when none is provided", function () {
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2024-06-10T12:00:00Z"));
            var createdAt = Math.floor(Date.parse("2024-06-10T12:00:00Z") / 1000);
            expect(formatShortDate({ createdAt: createdAt })).toMatch(/2024-06-10/);
            jest.useRealTimers();
        });
    });
});
//# sourceMappingURL=date.spec.js.map