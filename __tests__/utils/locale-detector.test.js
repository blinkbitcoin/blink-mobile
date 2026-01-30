import { matchOsLocaleToSupportedLocale } from "../../app/utils/locale-detector";
describe("matchOsLocaleToSupportedLocale", function () {
    it("exactly matches a supported locale", function () {
        var supportedCountyAndLang = [
            { countryCode: "CA", languageTag: "fr-CA", languageCode: "fr", isRTL: false },
        ];
        var locale = matchOsLocaleToSupportedLocale(supportedCountyAndLang);
        expect(locale).toEqual("fr");
    });
    it("approximately matches a supported locale", function () {
        var unsupportedCountrySupportedLang = [
            { countryCode: "SV", languageTag: "es-SV", languageCode: "es", isRTL: false },
        ];
        var locale = matchOsLocaleToSupportedLocale(unsupportedCountrySupportedLang);
        expect(locale).toEqual("es");
    });
    it("returns english when there is no locale match", function () {
        var unsupportedCountryAndLang = [
            { countryCode: "XY", languageTag: "na-XY", languageCode: "na", isRTL: false },
        ];
        var locale = matchOsLocaleToSupportedLocale(unsupportedCountryAndLang);
        expect(locale).toEqual("en");
    });
});
//# sourceMappingURL=locale-detector.test.js.map