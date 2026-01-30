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
import { View } from "react-native";
import { useApolloClient } from "@apollo/client";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select";
import { updateColorScheme } from "@app/graphql/client-only-query";
import { useColorSchemeQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
var useStyles = makeStyles(function () { return ({
    container: {
        padding: 10,
    },
    info: {
        marginTop: 20,
    },
}); });
export var ThemeScreen = function () {
    var _a, _b;
    var client = useApolloClient();
    var colorSchemeData = useColorSchemeQuery();
    var colorScheme = (_b = (_a = colorSchemeData === null || colorSchemeData === void 0 ? void 0 : colorSchemeData.data) === null || _a === void 0 ? void 0 : _a.colorScheme) !== null && _b !== void 0 ? _b : "system";
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var Themes = [
        {
            id: "system",
            text: LL.ThemeScreen.system(),
        },
        {
            id: "light",
            text: LL.ThemeScreen.light(),
        },
        {
            id: "dark",
            text: LL.ThemeScreen.dark(),
        },
    ];
    return (<Screen style={styles.container} preset="scroll">
      <MenuSelect value={colorScheme} onChange={function (scheme) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, updateColorScheme(client, scheme)];
    }); }); }}>
        {Themes.map(function (_a) {
            var id = _a.id, text = _a.text;
            return (<MenuSelectItem key={id} value={id}>
            {text}
          </MenuSelectItem>);
        })}
      </MenuSelect>
      <View style={styles.info}>
        <GaloyInfo>{LL.ThemeScreen.info()}</GaloyInfo>
      </View>
    </Screen>);
};
//# sourceMappingURL=theme-screen.js.map