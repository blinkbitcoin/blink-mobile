import * as React from "react";
import { Linking, View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { ListItem, makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { Screen } from "@app/components/screen";
import { SettingsGroup } from "./group";
var DASHBOARD_LINK = "https://dashboard.blink.sv";
var ApiItemRow = function (_a) {
    var colors = _a.colors, item = _a.item, onPress = _a.onPress, styles = _a.styles;
    return (<ListItem containerStyle={styles.listItemContainer} onPress={function () { return onPress(item); }}>
    <View style={styles.iconContainer}>
      <GaloyIcon name={item.leftIcon} size={24} color={colors.grey0}/>
    </View>
    <ListItem.Content>
      <ListItem.Title style={styles.itemTitle}>
        <View style={styles.listContent}>
          <Text type="p2">{item.title}</Text>
          {item.infoIcon && (<GaloyIcon name={item.infoIcon} size={18} color={colors.black}/>)}
        </View>
      </ListItem.Title>
    </ListItem.Content>
    <GaloyIcon name={item.rightIcon} size={24} color={colors.warning}/>
  </ListItem>);
};
ApiItemRow.displayName = "ApiItemRow";
export var ApiScreen = function () {
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var apiItems = [
        {
            id: "documentation",
            title: LL.SettingsScreen.apiDocumentation(),
            leftIcon: "document-outline",
            rightIcon: "link",
            link: DASHBOARD_LINK,
        },
        {
            id: "dashboard",
            title: LL.SettingsScreen.apiDashboard(),
            leftIcon: "house-outline",
            rightIcon: "link",
            link: DASHBOARD_LINK,
            infoIcon: "question",
        },
    ];
    var handleItemPress = function (item) {
        Linking.openURL(item.link);
    };
    var apiSettings = apiItems.map(function (item) {
        var ApiItemRowWithItem = function () { return (<ApiItemRow colors={colors} item={item} onPress={handleItemPress} styles={styles}/>); };
        ApiItemRowWithItem.displayName = "ApiItemRow-".concat(item.id);
        return ApiItemRowWithItem;
    });
    return (<Screen style={styles.container} preset="scroll">
      <SettingsGroup items={apiSettings}/>
    </Screen>);
};
var useStyles = makeStyles(function (theme) { return ({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 20,
    },
    listItemContainer: {
        backgroundColor: theme.colors.transparent,
    },
    iconContainer: {
        marginRight: 12,
    },
    itemTitle: {
        fontSize: 16,
    },
    listContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
}); });
//# sourceMappingURL=api-screen.js.map