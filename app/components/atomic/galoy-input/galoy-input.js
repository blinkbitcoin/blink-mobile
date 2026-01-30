import * as React from "react";
import { Input, makeStyles } from "@rn-vui/themed";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        inputContainerFocused: {
            borderBottomColor: colors.grey3,
        },
    });
});
var GaloyInputFunction = function (props, ref) {
    var _a;
    var styles = useStyles();
    var _b = React.useState((_a = props.initIsFocused) !== null && _a !== void 0 ? _a : false), isFocused = _b[0], setIsFocused = _b[1];
    return (<Input {...props} inputContainerStyle={[
            props.inputContainerStyle,
            isFocused ? styles.inputContainerFocused : null,
        ]} onFocus={function (e) {
            var _a;
            setIsFocused(true);
            (_a = props.onFocus) === null || _a === void 0 ? void 0 : _a.call(props, e);
        }} onBlur={function (e) {
            var _a;
            setIsFocused(false);
            (_a = props.onBlur) === null || _a === void 0 ? void 0 : _a.call(props, e);
        }} ref={ref} autoComplete="off"/>);
};
var GaloyInput = React.forwardRef(GaloyInputFunction);
export { GaloyInput };
//# sourceMappingURL=galoy-input.js.map