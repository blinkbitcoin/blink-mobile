import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";
describe("parsePhoneNumber", function () {
    it("correctly handles extra 0", function () {
        var phoneWithLeadingZero = parsePhoneNumberFromString("07400123456", "GB");
        var phoneWithoutLeadingZero = parsePhoneNumberFromString("7400123456", "GB");
        expect(phoneWithLeadingZero === null || phoneWithLeadingZero === void 0 ? void 0 : phoneWithLeadingZero.isValid()).toBe(true);
        expect(phoneWithoutLeadingZero === null || phoneWithoutLeadingZero === void 0 ? void 0 : phoneWithoutLeadingZero.isValid()).toBe(true);
        expect(phoneWithLeadingZero === null || phoneWithLeadingZero === void 0 ? void 0 : phoneWithLeadingZero.number).toBe(phoneWithoutLeadingZero === null || phoneWithoutLeadingZero === void 0 ? void 0 : phoneWithoutLeadingZero.number);
    });
});
//# sourceMappingURL=phone-number-parser.test.js.map