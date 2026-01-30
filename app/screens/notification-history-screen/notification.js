import React, { useEffect, useState } from "react";
import { Icon, Text, makeStyles, useTheme } from "@rn-vui/themed";
import { View, Linking } from "react-native";
import { timeAgo } from "./utils";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { BLINK_DEEP_LINK_PREFIX } from "@app/config";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
export var Notification = function (_a) {
    var title = _a.title, body = _a.body, createdAt = _a.createdAt, acknowledgedAt = _a.acknowledgedAt, icon = _a.icon, action = _a.action;
    var _b = useState(Boolean(acknowledgedAt)), isAcknowledged = _b[0], setIsAcknowledged = _b[1];
    var styles = useStyles({ isAcknowledged: isAcknowledged });
    var colors = useTheme().theme.colors;
    useEffect(function () {
        if (acknowledgedAt && !isAcknowledged) {
            setIsAcknowledged(true);
        }
    }, [acknowledgedAt, isAcknowledged]);
    return (<TouchableWithoutFeedback onPress={function () {
            if ((action === null || action === void 0 ? void 0 : action.__typename) === "OpenDeepLinkAction")
                Linking.openURL(BLINK_DEEP_LINK_PREFIX + action.deepLink);
            else if ((action === null || action === void 0 ? void 0 : action.__typename) === "OpenExternalLinkAction")
                Linking.openURL(action.url);
        }}>
      <View style={styles.container}>
        {icon ? (<GaloyIcon name={icon === null || icon === void 0 ? void 0 : icon.toLowerCase().replace("_", "-")} color={isAcknowledged ? colors.grey2 : colors.black} size={26}/>) : (<Icon type="ionicon" name="notifications-outline" color={isAcknowledged ? colors.grey2 : colors.black} size={26}/>)}
        <View>
          <Text type="p2" style={styles.text}>
            {title}
          </Text>
          <Text type="p3" style={styles.text}>
            {body}
          </Text>
          <Text type="p4" style={styles.text}>
            {timeAgo(createdAt)}
          </Text>
        </View>
      </View>
    </TouchableWithoutFeedback>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var isAcknowledged = _b.isAcknowledged;
    return ({
        container: {
            padding: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.grey5,
            display: "flex",
            flexDirection: "row",
            columnGap: 12,
            alignItems: "center",
        },
        text: {
            color: isAcknowledged ? colors.grey2 : colors.black,
        },
    });
});
//# sourceMappingURL=notification.js.map