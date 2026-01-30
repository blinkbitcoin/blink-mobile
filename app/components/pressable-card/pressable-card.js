import React from "react";
import { Animated, Easing, Pressable } from "react-native";
export var PressableCard = function (_a) {
    var children = _a.children, onPress = _a.onPress;
    var scaleAnim = React.useRef(new Animated.Value(1)).current;
    var breatheIn = function () {
        Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
        }).start();
    };
    var breatheOut = function () {
        onPress();
        Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
        }).start();
    };
    return (<Pressable onPressIn={breatheIn} onPressOut={breatheOut}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>);
};
//# sourceMappingURL=pressable-card.js.map