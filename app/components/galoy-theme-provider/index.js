var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import * as React from "react";
import { Appearance } from "react-native";
import { useColorSchemeQuery } from "@app/graphql/generated";
import theme from "@app/rne-theme/theme";
import { ThemeProvider } from "@rn-vui/themed";
export var GaloyThemeProvider = function (_a) {
    var _b;
    var children = _a.children;
    var data = useColorSchemeQuery();
    var colorScheme = (_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.colorScheme;
    var mode = "light";
    if (colorScheme === "system" || !colorScheme) {
        var systemScheme = Appearance.getColorScheme();
        if (systemScheme) {
            mode = systemScheme;
        }
    }
    else {
        mode = colorScheme;
    }
    return (<ThemeProvider theme={__assign(__assign({}, theme), { mode: mode })}>
      {children}
    </ThemeProvider>);
};
//# sourceMappingURL=index.js.map