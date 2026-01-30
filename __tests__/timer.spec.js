import { i18nObject } from "@app/i18n/i18n-util";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { formatTimeToMempool, timeToMempool, } from "@app/screens/transaction-detail-screen/format-time";
import { parseTimer } from "../app/utils/timer";
describe("parseTimer", function () {
    it("parse time when is more than 1 minute", function () {
        var outputTime = parseTimer(65);
        expect(outputTime).toStrictEqual("01:05");
    });
    it("parse time when is less than 1 minute", function () {
        var outputTime = parseTimer(40);
        expect(outputTime).toStrictEqual("00:40");
    });
    it("parse time when is less than 10 second", function () {
        var outputTime = parseTimer(8);
        expect(outputTime).toStrictEqual("00:08");
    });
    it("parse time when is negative", function () {
        var outputTime = parseTimer(-5);
        expect(outputTime).toStrictEqual("00:00");
    });
});
describe("formatTimeToMempool", function () {
    jest.useFakeTimers();
    jest.setSystemTime(1701819669000);
    loadLocale("en");
    var LL = i18nObject("en");
    it("format time when is more than 5 minutes", function () {
        var outputTime = formatTimeToMempool(timeToMempool(1701819969), LL, "en");
        expect(outputTime).toStrictEqual("in 5 minutes");
    });
    it("format time when is more than 1 minute", function () {
        var outputTime = formatTimeToMempool(timeToMempool(1701819734), LL, "en");
        expect(outputTime).toStrictEqual("in 1 minute");
    });
    it("format time when is less than 1 minute", function () {
        var outputTime = formatTimeToMempool(timeToMempool(1701819709), LL, "en");
        expect(outputTime).toStrictEqual("in 40 seconds");
    });
    it("format time when is less than 10 second", function () {
        var outputTime = formatTimeToMempool(timeToMempool(1701819678), LL, "en");
        expect(outputTime).toStrictEqual("in 9 seconds");
    });
    it("format time when is negative", function () {
        var outputTime = formatTimeToMempool(timeToMempool(1701819669), LL, "en");
        expect(outputTime).toStrictEqual(LL.TransactionDetailScreen.momentarily());
    });
});
//# sourceMappingURL=timer.spec.js.map