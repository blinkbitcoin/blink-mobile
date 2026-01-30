import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
export var useDropInOutAnimation = function (_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.visible, visible = _c === void 0 ? true : _c, _d = _b.delay, delay = _d === void 0 ? 0 : _d, _e = _b.distance, distance = _e === void 0 ? 56 : _e, _f = _b.durationIn, durationIn = _f === void 0 ? 180 : _f, _g = _b.durationOut, durationOut = _g === void 0 ? 180 : _g, _h = _b.overshoot, overshoot = _h === void 0 ? 5 : _h, _j = _b.springStiffness, springStiffness = _j === void 0 ? 200 : _j, _k = _b.springDamping, springDamping = _k === void 0 ? 18 : _k, _l = _b.springVelocity, springVelocity = _l === void 0 ? 0.4 : _l;
    var opacity = useRef(new Animated.Value(0)).current;
    var translateY = useRef(new Animated.Value(-distance)).current;
    var wasVisible = useRef(false);
    useEffect(function () {
        opacity.stopAnimation();
        translateY.stopAnimation();
        if (!visible) {
            if (wasVisible.current) {
                var exitAnim = Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: durationOut,
                        easing: Easing.in(Easing.cubic),
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -distance,
                        duration: durationOut,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]);
                exitAnim.start();
            }
            else {
                opacity.setValue(0);
                translateY.setValue(-distance);
            }
            wasVisible.current = false;
            return;
        }
        opacity.setValue(0);
        translateY.setValue(-distance);
        var entryAnim = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: Math.round(durationIn * 0.8),
                delay: delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.timing(translateY, {
                    toValue: overshoot,
                    duration: durationIn,
                    delay: delay,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    stiffness: springStiffness,
                    damping: springDamping,
                    mass: 0.6,
                    velocity: springVelocity,
                    useNativeDriver: true,
                }),
            ]),
        ]);
        entryAnim.start(function () {
            wasVisible.current = true;
        });
        return function () { return entryAnim.stop(); };
    }, [
        visible,
        delay,
        distance,
        durationIn,
        durationOut,
        overshoot,
        springStiffness,
        springDamping,
        springVelocity,
        opacity,
        translateY,
    ]);
    return { opacity: opacity, translateY: translateY };
};
//# sourceMappingURL=drop-in-out-animation.js.map