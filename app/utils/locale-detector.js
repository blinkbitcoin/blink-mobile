var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as RNLocalize from "react-native-localize";
import { locales } from "@app/i18n/i18n-util";
export var matchOsLocaleToSupportedLocale = function (localesFromOs) {
    var languageCodeFromOs = localesFromOs.map(function (osLocale) { return osLocale.languageCode; });
    var firstSupportedLocale = "en";
    var _loop_1 = function (languageCode) {
        var match = locales.find(function (locale) { return languageCode.startsWith(locale); });
        if (match) {
            firstSupportedLocale = match;
            return "break";
        }
    };
    for (var _i = 0, languageCodeFromOs_1 = languageCodeFromOs; _i < languageCodeFromOs_1.length; _i++) {
        var languageCode = languageCodeFromOs_1[_i];
        var state_1 = _loop_1(languageCode);
        if (state_1 === "break")
            break;
    }
    return firstSupportedLocale;
};
export var detectDefaultLocale = function () {
    var localesFromOs = RNLocalize.getLocales();
    return matchOsLocaleToSupportedLocale(localesFromOs);
};
export var Languages = __spreadArray(["DEFAULT"], locales, true);
export var getLanguageFromString = function (language) {
    if (!language) {
        return "DEFAULT";
    }
    var exactMatchLanguage = locales.find(function (locale) { return locale === language; });
    if (exactMatchLanguage) {
        return exactMatchLanguage;
    }
    // previously we used the following values for setting the language sever side
    // ["DEFAULT", "en-US", "es-SV", "pt-BR", "fr-CA", "de-DE", "cs"]
    var approximateMatchLocale = locales.find(function (locale) {
        return locale.startsWith(language.split("-")[0]);
    });
    return approximateMatchLocale || "DEFAULT";
};
export var getLocaleFromLanguage = function (language) {
    if (language === "DEFAULT") {
        return detectDefaultLocale();
    }
    return language;
};
//# sourceMappingURL=locale-detector.js.map