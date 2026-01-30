import React from "react";
import { Text as RNText } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { makeStyles } from "@rn-vui/themed";
import { useIsFocused } from "@react-navigation/native";
import { useBounceInAnimation } from "../animations/bounce-in-animation";
var BOUNCE_DELAY = 300;
var BOUNCE_DURATION = 120;
export var NotificationBadge = function (_a) {
    var _b = _a.visible, visible = _b === void 0 ? false : _b, text = _a.text, _c = _a.size, size = _c === void 0 ? 12 : _c, _d = _a.top, top = _d === void 0 ? -5 : _d, _e = _a.right, right = _e === void 0 ? -4 : _e, style = _a.style, _f = _a.maxWidth, maxWidth = _f === void 0 ? 48 : _f;
    var styles = useStyles({ size: size, top: top, right: right, maxWidth: maxWidth });
    var isFocused = useIsFocused();
    var scale = useSharedValue(1);
    var rendered = useBounceInAnimation({
        isFocused: isFocused,
        visible: visible,
        scale: scale,
        delay: BOUNCE_DELAY,
        duration: BOUNCE_DURATION,
    });
    var animatedStyle = useAnimatedStyle(function () { return ({ transform: [{ scale: scale.value }] }); }, [scale]);
    if (!rendered)
        return null;
    var hasText = typeof text === "string" && text.trim().length > 0;
    if (!hasText) {
        return (<Animated.View pointerEvents="none" style={[styles.dot, animatedStyle, style]}/>);
    }
    return (<Animated.View pointerEvents="none" style={[styles.pill, animatedStyle, style]}>
      <RNText numberOfLines={1} ellipsizeMode="tail" style={styles.pillText}>
        {text}
      </RNText>
    </Animated.View>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var size = _b.size, top = _b.top, right = _b.right, maxWidth = _b.maxWidth;
    return ({
        dot: {
            position: "absolute",
            top: top,
            right: right,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.black,
            borderColor: colors.black,
            borderWidth: 1,
        },
        pill: {
            position: "absolute",
            top: top,
            right: right,
            minWidth: size,
            height: size,
            maxWidth: maxWidth,
            paddingHorizontal: 6,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.black,
            borderColor: colors.black,
            borderWidth: 1,
        },
        pillText: {
            color: colors.white,
            fontSize: 11,
            fontWeight: "700",
            includeFontPadding: false,
        },
    });
});
//# sourceMappingURL=index.js.map