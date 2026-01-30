import * as React from "react";
import { View } from "react-native";
import Animated, { Extrapolate, interpolate, useAnimatedStyle, } from "react-native-reanimated";
import { makeStyles } from "@rn-vui/themed";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors._white,
            borderRadius: 50,
            overflow: "hidden",
        },
        animatedStyle: {
            borderRadius: 50,
            flex: 1,
        },
    });
});
export var PaginationItem = function (props) {
    var styles = useStyles();
    var animValue = props.animValue, index = props.index, length = props.length, backgroundColor = props.backgroundColor, isRotate = props.isRotate;
    var width = 10;
    var containerDynamicStyle = {
        height: width,
        width: width,
        transform: [
            {
                rotateZ: isRotate ? "90deg" : "0deg",
            },
        ],
    };
    // not sure why it's needed. maybe need to look into when upgrading react native reanimated
    /* eslint @typescript-eslint/ban-ts-comment: "off" */
    // @ts-ignore-next-line
    var animStyle = useAnimatedStyle(function () {
        var inputRange = [index - 1, index, index + 1];
        var outputRange = [-width, 0, width];
        if (index === 0 && (animValue === null || animValue === void 0 ? void 0 : animValue.value) > length - 1) {
            inputRange = [length - 1, length, length + 1];
            outputRange = [-width, 0, width];
        }
        return {
            transform: [
                {
                    translateX: interpolate(animValue === null || animValue === void 0 ? void 0 : animValue.value, inputRange, outputRange, Extrapolate.CLAMP),
                },
            ],
        };
    }, [animValue, index, length]);
    return (<View style={[styles.container, containerDynamicStyle]}>
      <Animated.View style={[styles.animatedStyle, { backgroundColor: backgroundColor }, animStyle]}/>
    </View>);
};
//# sourceMappingURL=pagination-item.js.map