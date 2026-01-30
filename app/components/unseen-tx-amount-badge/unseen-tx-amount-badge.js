import * as React from "react";
import { Animated, Pressable } from "react-native";
import { Text, makeStyles } from "@rn-vui/themed";
import { useDropInOutAnimation } from "@app/components/animations";
var UNSEEN_BADGE_ANIMATION = {
    delay: 300,
    distance: 15,
    durationIn: 180,
    durationOut: 180,
};
export var UnseenTxAmountBadge = function (_a) {
    var amountText = _a.amountText, _b = _a.visible, visible = _b === void 0 ? true : _b, onPress = _a.onPress, isOutgoing = _a.isOutgoing;
    var styles = useStyles({ isOutgoing: isOutgoing });
    var _c = useDropInOutAnimation({
        visible: visible,
        delay: UNSEEN_BADGE_ANIMATION.delay,
        distance: UNSEEN_BADGE_ANIMATION.distance,
        durationIn: UNSEEN_BADGE_ANIMATION.durationIn,
        durationOut: UNSEEN_BADGE_ANIMATION.durationOut,
    }), opacity = _c.opacity, translateY = _c.translateY;
    var _d = React.useState(visible), shouldRender = _d[0], setShouldRender = _d[1];
    React.useEffect(function () {
        if (visible) {
            setShouldRender(true);
            return;
        }
        var timeout = setTimeout(function () {
            setShouldRender(false);
        }, UNSEEN_BADGE_ANIMATION.durationOut);
        return function () { return clearTimeout(timeout); };
    }, [visible]);
    return (<Pressable accessibilityRole="button" accessibilityLabel={amountText} disabled={!visible} onPress={onPress} style={styles.touch}>
      <Animated.View key={amountText} style={[styles.badge, { opacity: opacity, transform: [{ translateY: translateY }] }]} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
        {shouldRender ? <Text style={styles.text}>{amountText}</Text> : null}
      </Animated.View>
    </Pressable>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var isOutgoing = _b.isOutgoing;
    return ({
        touch: {
            alignSelf: "center",
        },
        badge: {
            borderRadius: 8,
            paddingHorizontal: 20,
            alignSelf: "center",
        },
        text: {
            fontSize: 20,
            color: isOutgoing ? colors.grey2 : colors._green,
        },
    });
});
//# sourceMappingURL=unseen-tx-amount-badge.js.map