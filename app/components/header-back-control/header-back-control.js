import React from "react";
import { View } from "react-native";
import { HeaderBackButton } from "@react-navigation/elements";
import { makeStyles, useTheme } from "@rn-vui/themed";
export var InvisibleBackButton = function () {
    var styles = useStyles();
    return (<View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.container}>
      <HeaderBackButton onPress={function () { }}/>
    </View>);
};
var HeaderBackButtonWithTheme = function (props) {
    var colors = useTheme().theme.colors;
    return <HeaderBackButton {...props} pressColor={colors.grey5} pressOpacity={1}/>;
};
export var headerBackControl = function (_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.canGoBack, canGoBack = _c === void 0 ? true : _c;
    return canGoBack ? HeaderBackButtonWithTheme : InvisibleBackButton;
};
var useStyles = makeStyles(function () { return ({
    container: {
        opacity: 0,
    },
}); });
//# sourceMappingURL=header-back-control.js.map