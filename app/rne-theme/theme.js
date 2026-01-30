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
import { createTheme } from "@rn-vui/themed";
import { light, dark } from "./colors";
var theme = createTheme({
    lightColors: light,
    darkColors: dark,
    mode: "light",
    components: {
        Button: {
            containerStyle: {
                borderRadius: 50,
            },
            buttonStyle: {
                paddingHorizontal: 32,
                paddingVertical: 8,
                borderRadius: 50,
            },
        },
        Text: function (props, _a) {
            var colors = _a.colors;
            var universalStyle = {
                color: props.color || colors.black,
                // FIXME: is it automatically selecting the right font?
                // because there is only one?
                // fontFamily: "SourceSansPro",
            };
            var sizeStyle = props.type
                ? {
                    h1: {
                        fontSize: 24,
                        lineHeight: 32,
                        fontWeight: props.bold ? "600" : "400",
                    },
                    h2: {
                        fontSize: 20,
                        lineHeight: 24,
                        fontWeight: props.bold ? "600" : "400",
                    },
                    p1: {
                        fontSize: 18,
                        lineHeight: 24,
                        fontWeight: props.bold ? "600" : "400",
                    },
                    p2: {
                        fontSize: 16,
                        lineHeight: 24,
                        fontWeight: props.bold ? "600" : "400",
                    },
                    p3: {
                        fontSize: 14,
                        lineHeight: 18,
                        fontWeight: props.bold ? "600" : "400",
                    },
                    p4: {
                        fontSize: 12,
                        lineHeight: 18,
                        fontWeight: props.bold ? "600" : "400",
                    },
                }[props.type]
                : {};
            return {
                style: __assign(__assign({}, universalStyle), sizeStyle),
            };
        },
    },
});
export default theme;
//# sourceMappingURL=theme.js.map