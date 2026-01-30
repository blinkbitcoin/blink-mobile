import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { testProps } from "@app/utils/testProps";
import { makeStyles, Icon, Text, Skeleton, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
export var SettingsRow = function (_a) {
    var title = _a.title, subtitle = _a.subtitle, subtitleShorter = _a.subtitleShorter, leftIcon = _a.leftIcon, leftGaloyIcon = _a.leftGaloyIcon, _b = _a.rightIcon, rightIcon = _b === void 0 ? "" : _b, action = _a.action, _c = _a.rightIconAction, rightIconAction = _c === void 0 ? action : _c, _d = _a.extraComponentBesideTitle, extraComponentBesideTitle = _d === void 0 ? <></> : _d, loading = _a.loading, spinner = _a.spinner, _e = _a.expanded, expanded = _e === void 0 ? false : _e;
    var _f = useState(false), hovering = _f[0], setHovering = _f[1];
    var styles = useStyles({ hovering: hovering });
    var colors = useTheme().theme.colors;
    if (loading)
        return <Skeleton style={styles.container} animation="pulse"/>;
    if (spinner)
        return (<View style={[styles.container, styles.center]}>
        <ActivityIndicator />
      </View>);
    var defaultIcon = expanded ? "chevron-down" : "chevron-forward";
    var hasLeftIcon = Boolean(leftGaloyIcon || leftIcon);
    var RightIcon = rightIcon !== null &&
        (typeof rightIcon === "string" ? (<Icon name={rightIcon ? rightIcon : defaultIcon} type="ionicon" size={20} color={colors.primary}/>) : (rightIcon));
    return (<Pressable onPressIn={action ? function () { return setHovering(true); } : function () { }} onPressOut={action ? function () { return setHovering(false); } : function () { }} onPress={action ? action : undefined} {...testProps(title)}>
      <View style={[styles.container, styles.spacing]}>
        <View style={[styles.container, styles.spacing, styles.internalContainer]}>
          {hasLeftIcon &&
            (leftGaloyIcon ? (<GaloyIcon name={leftGaloyIcon} size={20}/>) : (<Icon name={leftIcon !== null && leftIcon !== void 0 ? leftIcon : ""} type="ionicon" size={20}/>))}
          <View>
            <View style={styles.sidetoside}>
              <Text type="p2" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
                {title}
              </Text>
              <Text>{extraComponentBesideTitle}</Text>
            </View>
            {subtitle && (<Text type={subtitleShorter ? "p4" : "p3"} ellipsizeMode="tail" numberOfLines={1}>
                {subtitle}
              </Text>)}
          </View>
        </View>
        <Pressable onPress={rightIconAction ? rightIconAction : undefined} {...testProps(title + "-right")}>
          <View style={styles.rightActionTouchArea}>{RightIcon}</View>
        </Pressable>
      </View>
    </Pressable>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var hovering = _b.hovering;
    return ({
        container: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            columnGap: 16,
            backgroundColor: hovering ? colors.grey4 : undefined,
            minHeight: 58,
        },
        spacing: {
            paddingHorizontal: 8,
            paddingRight: 0,
        },
        center: {
            justifyContent: "space-around",
        },
        rightActionTouchArea: {
            paddingVertical: 17,
            paddingLeft: 14,
            paddingRight: 10,
            position: "relative",
        },
        sidetoside: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            columnGap: 5,
        },
        internalContainer: {
            flex: 1,
            justifyContent: "flex-start",
            paddingRight: 18,
            minWidth: 0,
        },
        title: {
            flexShrink: 1,
        },
    });
});
//# sourceMappingURL=row.js.map