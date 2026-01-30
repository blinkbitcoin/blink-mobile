import React from "react";
import { View } from "react-native";
import { testProps } from "@app/utils/testProps";
import { makeStyles, useTheme, Text, Divider } from "@rn-vui/themed";
export var SettingsGroup = function (_a) {
    var name = _a.name, items = _a.items;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var filteredItems = items.filter(function (x) { return x({}) !== null; });
    return (<View>
      {name && (<Text {...testProps(name + "-group")} type="p2">
          {name}
        </Text>)}
      <View style={styles.groupCard}>
        {filteredItems.map(function (Element, index) { return (<View key={index}>
            <Element />
            {index < filteredItems.length - 1 && (<Divider color={colors.grey4} style={styles.divider}/>)}
          </View>); })}
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        groupCard: {
            marginTop: 5,
            backgroundColor: colors.grey5,
            borderRadius: 12,
            overflow: "hidden",
        },
        divider: {
            marginHorizontal: 14,
        },
    });
});
//# sourceMappingURL=group.js.map