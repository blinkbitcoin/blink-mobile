import { formatBtcWithSuffix, findBtcSuffixIndex, BTC_SUFFIX, } from "@app/screens/conversion-flow/btc-format";
describe("btc-format", function () {
    describe("formatBtcWithSuffix", function () {
        it("returns empty string when digits is empty", function () {
            expect(formatBtcWithSuffix("")).toBe("");
        });
        it("returns formatted string with SAT suffix", function () {
            expect(formatBtcWithSuffix("100")).toBe("100 SAT");
        });
        it("returns formatted string with comma-separated digits", function () {
            expect(formatBtcWithSuffix("1,000")).toBe("1,000 SAT");
        });
        it("returns formatted string with decimal digits", function () {
            expect(formatBtcWithSuffix("100.50")).toBe("100.50 SAT");
        });
    });
    describe("findBtcSuffixIndex", function () {
        it("returns correct index when SAT suffix is present", function () {
            expect(findBtcSuffixIndex("100 SAT")).toBe(3);
        });
        it("returns correct index when sat suffix is lowercase", function () {
            expect(findBtcSuffixIndex("100 sat")).toBe(3);
        });
        it("returns correct index when suffix has mixed case", function () {
            expect(findBtcSuffixIndex("100 Sat")).toBe(3);
        });
        it("returns string length when suffix is not present", function () {
            expect(findBtcSuffixIndex("100")).toBe(3);
        });
        it("returns string length when value is empty", function () {
            expect(findBtcSuffixIndex("")).toBe(0);
        });
        it("returns correct index for large numbers with suffix", function () {
            expect(findBtcSuffixIndex("1,000,000 SAT")).toBe(9);
        });
        it("does not match SAT without space before it", function () {
            expect(findBtcSuffixIndex("100SAT")).toBe(6);
        });
    });
    describe("BTC_SUFFIX", function () {
        it("has correct value", function () {
            expect(BTC_SUFFIX).toBe("SAT");
        });
    });
});
//# sourceMappingURL=btc-format.spec.js.map