import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, } from "react-native-reanimated";
import Icon from "react-native-vector-icons/Ionicons";
import { makeStyles, useTheme } from "@rn-vui/themed";
var TOUCH_AREA_HEIGHT = 82;
var MAX_SWIPE_DISTANCE = 80;
var SWIPE_COMPLETION_TOLERANCE = 5;
var SlideUpHandle = function (_a) {
    var onAction = _a.onAction, _b = _a.bottomOffset, bottomOffset = _b === void 0 ? 20 : _b, _c = _a.disabled, disabled = _c === void 0 ? false : _c;
    var colors = useTheme().theme.colors;
    var styles = useStyles({ bottomOffset: bottomOffset });
    var dragDistance = useSharedValue(0);
    var isActive = useSharedValue(0);
    var _d = useState(false), isLoading = _d[0], setIsLoading = _d[1];
    useEffect(function () {
        if (isLoading) {
            var timer_1 = setTimeout(function () { return setIsLoading(false); }, 1000);
            return function () { return clearTimeout(timer_1); };
        }
    }, [isLoading]);
    var gesture = Gesture.Pan()
        .enabled(!disabled && !isLoading)
        .onStart(function () {
        runOnJS(setIsLoading)(false);
        isActive.value = withTiming(1, { duration: 100 });
    })
        .onUpdate(function (event) {
        if (event.translationY >= 0) {
            dragDistance.value = 0;
            return;
        }
        var distance = Math.abs(event.translationY);
        dragDistance.value = Math.min(distance, MAX_SWIPE_DISTANCE);
    })
        .onEnd(function (event) {
        var isSwipingUp = event.translationY < 0;
        var isFullSwipe = isSwipingUp &&
            dragDistance.value >= MAX_SWIPE_DISTANCE - SWIPE_COMPLETION_TOLERANCE;
        if (isFullSwipe) {
            runOnJS(setIsLoading)(true);
            runOnJS(onAction)();
        }
        dragDistance.value = withSpring(0);
        isActive.value = withTiming(0, { duration: 120 });
    });
    var containerAnimatedStyle = useAnimatedStyle(function () { return ({
        opacity: isActive.value,
    }); });
    var progressBarStyle = useAnimatedStyle(function () {
        var progress = isLoading ? 1 : dragDistance.value / MAX_SWIPE_DISTANCE;
        return {
            height: interpolate(progress, [0, 1], [0, 64], Extrapolation.CLAMP),
        };
    });
    var iconAnimatedStyle = useAnimatedStyle(function () { return ({
        transform: [
            { translateY: -dragDistance.value * 0.35 },
            { scale: interpolate(isActive.value, [0, 1], [1, 1.06], Extrapolation.CLAMP) },
        ],
    }); });
    return (<View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.touchArea}>
          <Animated.View style={[styles.progressContainer, containerAnimatedStyle]}>
            <Animated.View style={[
            styles.progressFill,
            { backgroundColor: colors.grey3 },
            progressBarStyle,
        ]}/>
          </Animated.View>
          <Pressable disabled={disabled || isLoading} onPress={function () {
            if (disabled || isLoading)
                return;
            setIsLoading(true);
            onAction();
        }} style={styles.iconPressable}>
            {function (_a) {
            var pressed = _a.pressed;
            return (<Animated.View style={[
                    styles.iconContainer,
                    iconAnimatedStyle,
                    pressed && styles.iconPressed,
                ]}>
                {isLoading ? (<ActivityIndicator size="small" color={colors.grey2}/>) : (<Icon name="chevron-up-outline" size={18} color={colors.grey2}/>)}
              </Animated.View>);
        }}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var bottomOffset = _b.bottomOffset;
    return ({
        overlay: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomOffset,
            alignItems: "center",
            justifyContent: "center",
        },
        touchArea: {
            width: "90%",
            height: TOUCH_AREA_HEIGHT,
            alignItems: "center",
            justifyContent: "flex-end",
        },
        progressContainer: {
            position: "absolute",
            bottom: 10,
            width: 46,
            height: 64,
            borderRadius: 23,
            backgroundColor: colors.grey5,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "flex-end",
        },
        progressFill: {
            width: "100%",
            borderRadius: 23,
        },
        iconPressable: {
            marginBottom: 4,
        },
        iconContainer: {
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
        },
        iconPressed: {
            backgroundColor: colors.grey5,
            borderRadius: 20,
        },
    });
});
export default SlideUpHandle;
//# sourceMappingURL=index.js.map