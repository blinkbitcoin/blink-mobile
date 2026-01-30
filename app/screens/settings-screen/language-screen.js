var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as React from "react";
import { gql } from "@apollo/client";
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select";
import { useLanguageQuery, useUserUpdateLanguageMutation } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { LocaleToTranslateLanguageSelector } from "@app/i18n/mapping";
import { getLanguageFromString, Languages } from "@app/utils/locale-detector";
import { Screen } from "../../components/screen";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query language {\n    me {\n      id\n      language\n    }\n  }\n\n  mutation userUpdateLanguage($input: UserUpdateLanguageInput!) {\n    userUpdateLanguage(input: $input) {\n      errors {\n        message\n      }\n      user {\n        id\n        language\n      }\n    }\n  }\n"], ["\n  query language {\n    me {\n      id\n      language\n    }\n  }\n\n  mutation userUpdateLanguage($input: UserUpdateLanguageInput!) {\n    userUpdateLanguage(input: $input) {\n      errors {\n        message\n      }\n      user {\n        id\n        language\n      }\n    }\n  }\n"])));
export var LanguageScreen = function () {
    var _a;
    var isAuthed = useIsAuthed();
    var data = useLanguageQuery({
        fetchPolicy: "cache-first",
        skip: !isAuthed,
    }).data;
    var languageFromServer = getLanguageFromString((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.language);
    var _b = useUserUpdateLanguageMutation(), updateLanguage = _b[0], loading = _b[1].loading;
    var LL = useI18nContext().LL;
    var _c = React.useState(""), newLanguage = _c[0], setNewLanguage = _c[1];
    var handleUpdateLanguage = function (language) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (loading)
                        return [2 /*return*/];
                    return [4 /*yield*/, updateLanguage({ variables: { input: { language: language } } })];
                case 1:
                    _a.sent();
                    setNewLanguage(language);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<Screen preset="scroll">
      <MenuSelect value={newLanguage || languageFromServer} onChange={handleUpdateLanguage}>
        {Languages.map(function (language) {
            var languageTranslated;
            if (language === "DEFAULT") {
                languageTranslated = LL.Languages[language]();
            }
            else {
                languageTranslated = LocaleToTranslateLanguageSelector[language];
            }
            return (<MenuSelectItem key={language} value={language} testPropId={languageTranslated}>
              {languageTranslated}
            </MenuSelectItem>);
        })}
      </MenuSelect>
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=language-screen.js.map