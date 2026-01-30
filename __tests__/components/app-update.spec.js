import { isUpdateAvailableOrRequired } from "@app/components/app-update/app-update.logic";
var mobileVersions = [
    {
        __typename: "MobileVersions",
        platform: "android",
        currentSupported: 294,
        minSupported: 182,
    },
    {
        __typename: "MobileVersions",
        platform: "ios",
        currentSupported: 295,
        minSupported: 182,
    },
];
var OS = "ios";
describe("testing isUpdateAvailableOrRequired with normal build number", function () {
    it("outdated should return true", function () {
        var buildNumber = 150;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(true);
        expect(result.available).toBe(true);
    });
    it("above minSupported should should return true for available", function () {
        var buildNumber = 200;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(true);
    });
    it("current should return false", function () {
        var buildNumber = 295;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(false);
    });
    it("above should return false", function () {
        var buildNumber = 300;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(false);
    });
});
describe("testing isUpdateAvailableOrRequired with android abi", function () {
    it("outdated should return true", function () {
        var buildNumber = 150 + 10000000;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(true);
        expect(result.available).toBe(true);
    });
    it("above minSupported should should return true for available", function () {
        var buildNumber = 200 + 10000000;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(true);
    });
    it("current should return false", function () {
        var buildNumber = 295 + 20000000;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(false);
    });
    it("above should return false", function () {
        var buildNumber = 300 + 30000000;
        var result = isUpdateAvailableOrRequired({ buildNumber: buildNumber, mobileVersions: mobileVersions, OS: OS });
        expect(result.required).toBe(false);
        expect(result.available).toBe(false);
    });
});
//# sourceMappingURL=app-update.spec.js.map