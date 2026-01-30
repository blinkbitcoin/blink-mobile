import { ellipsizeMiddle, normalizeString } from "@app/utils/helper";
describe("ellipsizeMiddle", function () {
    it("returns original text when it fits", function () {
        var text = "simple text";
        var result = ellipsizeMiddle(text);
        expect(result).toBe(text);
    });
    it("cuts long text with default settings", function () {
        var text = "this text is clearly longer than the default display limit used in ui";
        var result = ellipsizeMiddle(text);
        expect(result.startsWith(text.slice(0, 13))).toBe(true);
        expect(result.endsWith(text.slice(text.length - 8))).toBe(true);
        expect(result).toContain("...");
    });
    it("cuts using custom options", function () {
        var text = "custom-options-text-to-verify-middle-ellipsis";
        var result = ellipsizeMiddle(text, {
            maxLength: 25,
            maxResultLeft: 7,
            maxResultRight: 5,
        });
        expect(result).toBe(text.slice(0, 7) + "..." + text.slice(text.length - 5));
    });
    it("keeps current destination style (50, 13, 8)", function () {
        var text = "lightning-invoice-for-some-user-to-pay-a-small-amount-123456";
        var result = ellipsizeMiddle(text, {
            maxLength: 50,
            maxResultLeft: 13,
            maxResultRight: 8,
        });
        expect(result.startsWith(text.slice(0, 13))).toBe(true);
        expect(result.endsWith(text.slice(text.length - 8))).toBe(true);
    });
});
describe("normalizeString", function () {
    it("trims whitespace and converts to lowercase", function () {
        expect(normalizeString("  Hello World  ")).toBe("hello world");
    });
    it("handles uppercase strings", function () {
        expect(normalizeString("UPPERCASE")).toBe("uppercase");
    });
    it("returns empty string for undefined", function () {
        expect(normalizeString(undefined)).toBe("");
    });
    it("returns empty string for empty input", function () {
        expect(normalizeString("")).toBe("");
    });
    it("handles strings with only whitespace", function () {
        expect(normalizeString("   ")).toBe("");
    });
});
//# sourceMappingURL=helper.spec.js.map