import React from "react";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, } from "react-native-reanimated";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
var TRACK_WIDTH = 51;
var TRACK_HEIGHT = 31;
var THUMB_SIZE = 27;
var THUMB_OFFSET = 2;
var ANIMATION_DURATION = 150;
var HIT_SLOP = 0;
export var Switch = function (_a) {
    var value = _a.value, onValueChange = _a.onValueChange, _b = _a.disabled, disabled = _b === void 0 ? false : _b, style = _a.style, testID = _a.testID, accessibilityLabel = _a.accessibilityLabel;
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var progress = useSharedValue(value ? 1 : 0);
    var skipNextAnimationRef = React.useRef(false);
    React.useEffect(function () {
        if (skipNextAnimationRef.current) {
            skipNextAnimationRef.current = false;
            return;
        }
        progress.value = withTiming(value ? 1 : 0, { duration: ANIMATION_DURATION });
    }, [value, progress]);
    var handlePress = function () {
        if (!disabled) {
            skipNextAnimationRef.current = true;
            progress.value = withTiming(value ? 0 : 1, { duration: ANIMATION_DURATION });
            onValueChange(!value);
        }
    };
    var animatedTrackStyle = useAnimatedStyle(function () {
        var backgroundColor = interpolateColor(progress.value, [0, 1], [colors.grey4, colors.primary]);
        return {
            backgroundColor: backgroundColor,
        };
    });
    var animatedThumbStyle = useAnimatedStyle(function () {
        var translateX = progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2);
        return {
            transform: [{ translateX: translateX }],
        };
    });
    return (<Pressable accessibilityRole="switch" accessibilityLabel={accessibilityLabel !== null && accessibilityLabel !== void 0 ? accessibilityLabel : LL.common.switch()} accessibilityState={{ checked: value, disabled: disabled }} onPressIn={handlePress} hitSlop={HIT_SLOP} disabled={disabled} style={style} testID={testID}>
      <Animated.View style={[styles.track, animatedTrackStyle, disabled && styles.trackDisabled]}>
        <Animated.View style={[styles.thumb, animatedThumbStyle]}/>
      </Animated.View>
    </Pressable>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        track: {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            justifyContent: "center",
            paddingHorizontal: THUMB_OFFSET,
        },
        trackDisabled: {
            opacity: 0.5,
        },
        thumb: {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: colors._white,
            shadowColor: colors._black,
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.2,
            shadowRadius: 2.5,
            elevation: 4,
        },
    });
});
//# sourceMappingURL=switch.js.map