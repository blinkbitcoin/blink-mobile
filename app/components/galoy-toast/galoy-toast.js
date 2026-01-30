import * as React from "react";
import Toast, { SuccessToast, ErrorToast, } from "react-native-toast-message";
import { light } from "../../rne-theme/colors";
var styles = {
    text1StyleSuccess: {
        fontSize: 16,
        color: light._green,
    },
    text1StyleError: {
        fontSize: 16,
        color: light.red,
    },
    text2Style: {
        fontSize: 14,
        color: light._black,
    },
    container: {
        height: undefined,
        paddingVertical: 5,
    },
};
var toastConfig = {
    success: function (props) { return (<SuccessToast {...props} text2NumberOfLines={2} style={[{ borderLeftColor: light._green }, styles.container]} text1Style={styles.text1StyleSuccess} text2Style={styles.text2Style}/>); },
    error: function (props) { return (<ErrorToast {...props} text2NumberOfLines={2} style={[{ borderLeftColor: light.red }, styles.container]} text1Style={styles.text1StyleError} text2Style={styles.text2Style}/>); },
};
export var GaloyToast = function () {
    return <Toast config={toastConfig}/>;
};
//# sourceMappingURL=galoy-toast.js.map