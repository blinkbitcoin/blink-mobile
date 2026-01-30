import { isPhoneNumber, parseValidPhoneNumber } from "../../app/utils/phone";
describe("parseValidPhoneNumber", function () {
    it("returns parsed phone for valid international number", function () {
        var result = parseValidPhoneNumber("+14155552671");
        expect(result).not.toBeNull();
        expect(result === null || result === void 0 ? void 0 : result.isValid()).toBe(true);
        expect(result === null || result === void 0 ? void 0 : result.country).toBe("US");
    });
    it("returns parsed phone for valid number with country code", function () {
        var result = parseValidPhoneNumber("7400123456", "GB");
        expect(result).not.toBeNull();
        expect(result === null || result === void 0 ? void 0 : result.isValid()).toBe(true);
        expect(result === null || result === void 0 ? void 0 : result.country).toBe("GB");
    });
    it("returns null for invalid phone number", function () {
        expect(parseValidPhoneNumber("invalid")).toBeNull();
        expect(parseValidPhoneNumber("123")).toBeNull();
        expect(parseValidPhoneNumber("")).toBeNull();
    });
    it("returns null for invalid country code combination", function () {
        expect(parseValidPhoneNumber("123", "US")).toBeNull();
    });
});
describe("isPhoneNumber", function () {
    it("returns true for valid international phone numbers", function () {
        expect(isPhoneNumber("+14155552671")).toBe(true);
        expect(isPhoneNumber("+447400123456")).toBe(true);
        expect(isPhoneNumber("+50370123456")).toBe(true);
    });
    it("returns false for invalid phone numbers", function () {
        expect(isPhoneNumber("invalid")).toBe(false);
        expect(isPhoneNumber("123")).toBe(false);
        expect(isPhoneNumber("")).toBe(false);
    });
    it("returns false for usernames that look like numbers", function () {
        expect(isPhoneNumber("user123")).toBe(false);
        expect(isPhoneNumber("test@blink.sv")).toBe(false);
    });
    it("returns false for valid phone numbers without plus sign even when format is recognized", function () {
        expect(isPhoneNumber("14155552671")).toBe(false);
    });
});
//# sourceMappingURL=phone.spec.js.map