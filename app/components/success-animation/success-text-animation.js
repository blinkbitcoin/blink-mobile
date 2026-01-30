import React from "react";
import Animated, { ZoomInEasyUp } from "react-native-reanimated";
import { ANIMATION_DELAY, ANIMATION_DURATION } from "./config";
export var CompletedTextAnimation = function (_a) {
    var children = _a.children;
    return (<Animated.View entering={ZoomInEasyUp.duration(ANIMATION_DURATION)
            .springify()
            .delay(ANIMATION_DELAY)}>
      {children}
    </Animated.View>);
};
//# sourceMappingURL=success-text-animation.js.map