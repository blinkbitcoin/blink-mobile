import React, { useEffect } from "react";
import { ActivityIndicator, Dimensions, View, I18nManager } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, { Extrapolate, Extrapolation, FadeIn, FadeOut, interpolate, runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring, } from "react-native-reanimated";
import { testProps } from "@app/utils/testProps";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../galoy-icon";
var BUTTON_WIDTH = Dimensions.get("screen").width - 40;
var SWIPE_RANGE = BUTTON_WIDTH - 50;
var isRTL = I18nManager.isRTL;
var GaloySliderButton = function (_a) {
    var onSwipe = _a.onSwipe, initialText = _a.initialText, loadingText = _a.loadingText, _b = _a.isLoading, isLoading = _b === void 0 ? false : _b, _c = _a.disabled, disabled = _c === void 0 ? false : _c;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var X = useSharedValue(0);
    useEffect(function () {
        if (!isLoading) {
            X.value = withSpring(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);
    var animatedGestureHandler = useAnimatedGestureHandler({
        onActive: function (e) {
            var newValue = Math.abs(e.translationX);
            if (newValue >= 0 && newValue <= SWIPE_RANGE) {
                X.value = newValue;
            }
        },
        onEnd: function () {
            if (X.value < SWIPE_RANGE * 0.6) {
                X.value = withSpring(0);
            }
            else {
                runOnJS(onSwipe)();
            }
        },
    });
    var AnimatedStyles = {
        swipeButton: useAnimatedStyle(function () {
            var translateX = interpolate(X.value, [20, BUTTON_WIDTH], [0, BUTTON_WIDTH], Extrapolation.CLAMP);
            return {
                transform: [
                    {
                        translateX: isRTL ? -translateX : translateX,
                    },
                ],
            };
        }, [X, isRTL]),
        swipeText: useAnimatedStyle(function () {
            var translateX = interpolate(X.value, [20, SWIPE_RANGE], [0, BUTTON_WIDTH / 3], Extrapolate.CLAMP);
            return {
                opacity: interpolate(X.value, [0, BUTTON_WIDTH / 4], [1, 0], Extrapolate.CLAMP),
                transform: [
                    {
                        translateX: isRTL ? -translateX : translateX,
                    },
                ],
            };
        }, [X, isRTL]),
    };
    return (<View style={styles.swipeButtonContainer}>
      {!isLoading && (<PanGestureHandler enabled={!isLoading && !disabled} onGestureEvent={animatedGestureHandler} {...testProps("slider")}>
          <Animated.View style={[
                styles.swipeButton,
                AnimatedStyles.swipeButton,
                { backgroundColor: disabled ? colors.disabled : colors.primary },
            ]} exiting={FadeOut.duration(400)}>
            {isRTL ? (<GaloyIcon size={30} name="arrow-left" color="white"/>) : (<GaloyIcon size={30} name="arrow-right" color="white"/>)}
          </Animated.View>
        </PanGestureHandler>)}
      {!disabled && (<Animated.Text style={[styles.swipeText, AnimatedStyles.swipeText]}>
          {initialText}
        </Animated.Text>)}
      {isLoading && (<Animated.View entering={FadeIn.duration(400)} style={styles.loadingContainer}>
          <Text style={styles.swipeText}>{loadingText}</Text>
          <ActivityIndicator size="small" color={colors.primary}/>
        </Animated.View>)}
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        swipeButtonContainer: {
            height: 60,
            backgroundColor: colors.grey5,
            borderRadius: 30,
            borderColor: colors.grey4,
            borderWidth: 1,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            width: BUTTON_WIDTH,
            position: "relative",
        },
        swipeButton: {
            position: "absolute",
            left: 0,
            height: 60,
            width: 60,
            borderRadius: 30,
            zIndex: 3,
            alignItems: "center",
            justifyContent: "center",
        },
        swipeButtonDisabled: {
            backgroundColor: "#E4E9EE",
        },
        swipeText: {
            alignSelf: "center",
            fontSize: 14,
            fontWeight: "400",
            zIndex: 2,
            color: colors.grey2,
        },
        loadingContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            columnGap: 10,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
        },
    });
});
export default GaloySliderButton;
//# sourceMappingURL=galoy-slider-button.js.map