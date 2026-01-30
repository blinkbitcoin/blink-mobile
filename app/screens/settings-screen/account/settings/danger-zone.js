import { View, TouchableOpacity } from "react-native";
import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Icon, Text, makeStyles } from "@rn-vui/themed";
import { Delete } from "./delete";
import { LogOut } from "./logout";
import { useState } from "react";
export var DangerZoneSettings = function () {
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var _a = useState(false), expanded = _a[0], setExpanded = _a[1];
    var defaultIcon = expanded ? "chevron-down" : "chevron-forward";
    var _b = useLevel(), currentLevel = _b.currentLevel, isAtLeastLevelOne = _b.isAtLeastLevelOne, isAtLeastLevelZero = _b.isAtLeastLevelZero;
    if (!isAtLeastLevelZero)
        return <></>;
    return (<View style={styles.verticalSpacing}>
      <TouchableOpacity style={styles.titleStyle} onPress={function () { return setExpanded(!expanded); }}>
        <Icon name={defaultIcon} type="ionicon" size={20}/>
        <Text type="p2" bold>
          {LL.AccountScreen.dangerZone()}
        </Text>
      </TouchableOpacity>
      {isAtLeastLevelOne && expanded && <LogOut />}
      {currentLevel !== AccountLevel.NonAuth && expanded && <Delete />}
    </View>);
};
var useStyles = makeStyles(function () { return ({
    verticalSpacing: {
        marginTop: 5,
        display: "flex",
        flexDirection: "column",
        rowGap: 10,
    },
    titleStyle: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
}); });
//# sourceMappingURL=danger-zone.js.map