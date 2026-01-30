import React from "react";
import { View, Linking } from "react-native";
import { makeStyles, Text } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
export var FieldWithEvent = function (_a) {
    var title = _a.title, value = _a.value, subValue = _a.subValue;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var handleTextWithUrl = function (text) {
        var regex = /(https?:\/\/[^\s]+)/i;
        var match = text.match(regex);
        if (match) {
            var url = match[0];
            var textWithoutURL = text.replace(url, "").trim();
            return { text: textWithoutURL, url: url };
        }
        return { text: text };
    };
    var textData = handleTextWithUrl(value);
    return (<View style={styles.successActionFieldContainer}>
      <Text style={styles.titleFieldBackground} type={"p3"}>
        {title}
      </Text>
      <View style={styles.fieldBackground}>
        <View>
          {textData.text && (<Text style={styles.inputStyle} type={"p3"}>
              {textData.text}
            </Text>)}
          {textData.url && (<Text {...testProps(LL.ScanningQRCodeScreen.openLinkTitle())} style={[styles.inputStyle, styles.inputUrl]} onPress={function () { return Linking.openURL(textData.url); }} type={"p3"}>
              {textData.url}
            </Text>)}
          {subValue && (<Text type={"p3"} style={[styles.inputStyle, styles.subValueStyle]}>{"(".concat(subValue, ")")}</Text>)}
        </View>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        successActionFieldContainer: {
            flexDirection: "row",
            overflow: "hidden",
            alignItems: "flex-start",
        },
        titleFieldBackground: {
            fontWeight: "300",
            fontStyle: "normal",
            color: colors.grey2,
            minWidth: 80,
        },
        fieldBackground: {
            flex: 1,
            flexDirection: "row",
            justifyContent: "flex-end",
            color: colors.black,
        },
        inputStyle: {
            color: colors.black,
            textAlign: "right",
        },
        inputUrl: {
            color: colors.primary,
        },
        subValueStyle: {
            marginTop: 2,
        },
    });
});
//# sourceMappingURL=field-with-icon.js.map