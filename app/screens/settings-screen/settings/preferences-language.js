import React from "react";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { LocaleToTranslateLanguageSelector } from "@app/i18n/mapping";
import { getLanguageFromString } from "@app/utils/locale-detector";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var LanguageSetting = function () {
    var _a, _b;
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var _c = useSettingsScreenQuery(), data = _c.data, loading = _c.loading;
    var language = getLanguageFromString((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.language);
    var languageValue = !language || language === "DEFAULT"
        ? LL.SettingsScreen.setByOs()
        : (_b = LocaleToTranslateLanguageSelector[language]) !== null && _b !== void 0 ? _b : language;
    return (<SettingsRow loading={loading} title={"".concat(LL.common.language(), ": ").concat(languageValue)} leftIcon="language" action={function () { return navigate("language"); }}/>);
};
//# sourceMappingURL=preferences-language.js.map