import * as React from "react";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { testProps } from "@app/utils/testProps";
import { useTheme } from "@react-navigation/native";
import { Input, Text, makeStyles } from "@rn-vui/themed";
import { Screen } from "../screen";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        viewWrapper: { flex: 1 },
        activityIndicator: { marginTop: 12 },
        textContainer: {
            marginBottom: 20,
        },
        inputComponentContainerStyle: {
            flexDirection: "row",
            marginBottom: 20,
            paddingLeft: 0,
            paddingRight: 0,
            justifyContent: "center",
        },
        inputContainerStyle: {
            minWidth: 160,
            minHeight: 60,
            borderWidth: 2,
            borderBottomWidth: 2,
            paddingHorizontal: 10,
            borderColor: colors.primary5,
            borderRadius: 8,
            marginRight: 0,
        },
        inputStyle: {
            fontSize: 24,
            textAlign: "center",
        },
        errorContainer: {
            marginBottom: 20,
        },
    });
});
var placeholder = "000000";
export var CodeInput = function (_a) {
    var send = _a.send, header = _a.header, loading = _a.loading, errorMessage = _a.errorMessage, setErrorMessage = _a.setErrorMessage;
    var styles = useStyles();
    var colors = useTheme().colors;
    var _b = useState(""), code = _b[0], _setCode = _b[1];
    var setCode = function (codeInput) {
        var code = codeInput.trim();
        if (code.length > 6) {
            return;
        }
        setErrorMessage("");
        _setCode(code);
        if (code.length === 6) {
            send(code);
        }
    };
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type="h2">{header}</Text>
        </View>

        <Input {...testProps("code-input")} placeholder={placeholder} containerStyle={styles.inputComponentContainerStyle} inputContainerStyle={styles.inputContainerStyle} inputStyle={styles.inputStyle} value={code} onChangeText={setCode} renderErrorMessage={false} autoFocus={true} textContentType={"oneTimeCode"} keyboardType="numeric"/>
        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
          </View>)}
        {loading && (<ActivityIndicator style={styles.activityIndicator} size="large" color={colors.primary}/>)}
      </View>
    </Screen>);
};
//# sourceMappingURL=code-input.js.map