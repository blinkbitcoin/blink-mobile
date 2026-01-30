var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import * as React from "react";
import { View } from "react-native";
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed";
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var props = _b.props, isFocused = _b.isFocused;
    return ({
        ContainerStyle: {
            paddingBottom: 3,
            paddingTop: 3,
            marginLeft: 0,
            borderRadius: 10,
            backgroundColor: colors.primary4,
        },
        inputContainerFocused: {
            borderColor: colors.primary,
            backgroundColor: colors.white,
            marginLeft: -7,
            marginRight: -7,
        },
        errorStateStyle: {
            borderColor: colors.error,
        },
        labelComponentStyles: {
            marginBottom: 9,
            fontWeight: "400",
            color: colors.grey5,
            marginLeft: isFocused ? 2 : 10,
        },
        errorMessageStyles: {
            color: props.caption ? colors.grey5 : colors.error,
            textTransform: "capitalize",
            marginTop: 9,
            marginLeft: isFocused ? 2 : 10,
        },
        labelStyle: {
            display: "none",
        },
        errorStyle: {
            display: "none",
        },
    });
});
var GaloyInputFunctions = function (props, ref) {
    var _a;
    var colors = useTheme().theme.colors;
    var containerStyle = props.containerStyle, remainingProps = __rest(props, ["containerStyle"]);
    var _b = React.useState((_a = remainingProps.initIsFocused) !== null && _a !== void 0 ? _a : false), isFocused = _b[0], setIsFocused = _b[1];
    var styles = useStyles({ props: props, isFocused: isFocused });
    return (<View style={containerStyle}>
      <LabelComponent props={remainingProps} styles={styles.labelComponentStyles} labelStyle={remainingProps.labelStyle}/>
      <Input {...remainingProps} labelStyle={styles.labelStyle} errorStyle={styles.errorStyle} containerStyle={isFocused ? styles.ContainerStyle : null} inputContainerStyle={[
            remainingProps.inputContainerStyle,
            remainingProps.errorMessage ? styles.errorStateStyle : null,
            isFocused ? styles.inputContainerFocused : null,
        ]} placeholderTextColor={colors.grey4} onFocus={function (e) {
            var _a;
            setIsFocused(true);
            (_a = remainingProps.onFocus) === null || _a === void 0 ? void 0 : _a.call(remainingProps, e);
        }} onBlur={function (e) {
            var _a;
            setIsFocused(false);
            (_a = remainingProps.onBlur) === null || _a === void 0 ? void 0 : _a.call(remainingProps, e);
        }} ref={ref}/>
      <CaptionComponent props={remainingProps} styles={styles.errorMessageStyles} errorStyles={remainingProps.errorStyle}/>
    </View>);
};
var LabelComponent = function (_a) {
    var props = _a.props, labelStyle = _a.labelStyle, styles = _a.styles;
    if (!props.label)
        return null;
    return (<Text type="p2" style={[styles, labelStyle]}>
      {props.label}
    </Text>);
};
var CaptionComponent = function (_a) {
    var props = _a.props, errorStyles = _a.errorStyles, styles = _a.styles;
    if (!props.caption && !props.errorMessage)
        return null;
    return (<Text type="p3" style={[styles, errorStyles]}>
      {props.caption || props.errorMessage}
    </Text>);
};
var GaloyInputRedesigned = React.forwardRef(GaloyInputFunctions);
export { GaloyInputRedesigned };
//# sourceMappingURL=galoy-redesigned-input.js.map