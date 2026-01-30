import React from "react";
import { View } from "react-native";
import { makeStyles } from "@rn-vui/themed";
import { FieldWithEvent } from "./field-with-icon";
export var SuccessActionTag;
(function (SuccessActionTag) {
    SuccessActionTag["AES"] = "aes";
    SuccessActionTag["MESSAGE"] = "message";
    SuccessActionTag["URL"] = "url";
})(SuccessActionTag || (SuccessActionTag = {}));
export var SuccessActionComponent = function (_a) {
    var visible = _a.visible, title = _a.title, text = _a.text, subValue = _a.subValue;
    var styles = useStyles();
    if (!visible || !text) {
        return <></>;
    }
    return (<View style={styles.fieldContainer}>
      <FieldWithEvent title={title} value={text} subValue={subValue}/>
    </View>);
};
var useStyles = makeStyles(function () { return ({
    fieldContainer: {
        minWidth: "100%",
    },
}); });
//# sourceMappingURL=success-action.js.map