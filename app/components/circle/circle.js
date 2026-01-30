import { forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useCountUp } from "use-count-up";
import { testProps } from "@app/utils/testProps";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
// eslint-disable-next-line react/display-name
export var Circle = forwardRef(function (_a, ref) {
    var heading = _a.heading, value = _a.value, description = _a.description, subtitle = _a.subtitle, _b = _a.subtitleGreen, subtitleGreen = _b === void 0 ? false : _b, extraSubtitleLine = _a.extraSubtitleLine, _c = _a.bubble, bubble = _c === void 0 ? false : _c, minValue = _a.minValue, maxValue = _a.maxValue, helpBtnModal = _a.helpBtnModal, helpBtnModalEnable = _a.helpBtnModalEnable, _d = _a.countUpDuration, countUpDuration = _d === void 0 ? 0 : _d;
    var colors = useTheme().theme.colors;
    var styles = useStyles({
        subtitleGreen: subtitleGreen,
    });
    var easedCountUpDuration = getcBackValue(countUpDuration, minValue, maxValue, 0.5 * countUpDuration, countUpDuration);
    var _e = useCountUp({
        isCounting: true,
        end: value,
        duration: easedCountUpDuration,
    }), countUpValue = _e.value, reset = _e.reset;
    useImperativeHandle(ref, function () { return ({
        reset: reset,
    }); }, [reset]);
    var cBackValue = getcBackValue(Number(countUpValue), minValue, maxValue);
    var cBackStyles = {
        height: cBackValue,
        width: cBackValue,
        borderRadius: cBackValue / 2,
        marginLeft: -cBackValue / 2,
        marginTop: -cBackValue / 2,
    };
    return (<View style={styles.circleContainer}>
        <View style={styles.circleHeading}>
          <Text type="p1">{heading}</Text>
          {helpBtnModal && (<View style={styles.helpBtn}>
              {helpBtnModal}
              <Icon color={colors.primary} name="help-circle-outline" size={23} onPress={helpBtnModalEnable}/>
            </View>)}
        </View>
        <View style={styles.circleValueWrapper}>
          <View>
            <Text {...testProps("".concat(heading, "-value"))} style={styles.circleValue}>
              {countUpValue}
            </Text>
            {bubble && <View style={[styles.circleBubble, cBackStyles]}/>}
          </View>
          <Text style={styles.circleDescription}>{description}</Text>
        </View>
        {subtitle && <Text style={styles.circleSubtitle}>{subtitle}</Text>}
        {extraSubtitleLine && (<Text style={styles.circleSubtitleExtra}>{extraSubtitleLine}</Text>)}
      </View>);
});
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var subtitleGreen = _b.subtitleGreen;
    return {
        circleContainer: {
            marginLeft: "10%",
        },
        circleHeading: {
            marginBottom: 8,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            columnGap: 8,
        },
        circleValueWrapper: {
            display: "flex",
            flexDirection: "row",
            columnGap: 10,
            justifyContent: "flex-start",
            alignItems: "center",
            marginBottom: 4,
            position: "relative",
            width: "100%",
            paddingTop: 4,
            zIndex: -1,
        },
        circleValue: {
            fontWeight: "700",
            fontSize: 48,
            minWidth: 60,
            textAlign: "center",
            height: 60,
        },
        circleDescription: {
            maxWidth: "35%",
            marginBottom: 6,
            lineHeight: 20,
        },
        helpBtn: {
            alignSelf: "center",
        },
        circleSubtitle: {
            textAlign: "left",
            backgroundColor: subtitleGreen ? colors._green : colors.black,
            borderRadius: 10,
            paddingHorizontal: 10,
            alignSelf: "flex-start",
        },
        circleSubtitleExtra: { color: colors.black, marginTop: 4 },
        circleBubble: {
            position: "absolute",
            backgroundColor: colors.backdropWhiter,
            top: "50%",
            left: "50%",
        },
        loaderContainer: {
            flex: 1,
            justifyContent: "flex-end",
            alignItems: "flex-end",
            height: 45,
            marginTop: 5,
        },
        loaderBackground: {
            color: colors.loaderBackground,
        },
        loaderForefound: {
            color: colors.loaderForeground,
        },
    };
});
// ---------- HELPERS ----------
var easeOut = function (x, minValue, maxValue) {
    // Normalize x to 0-1 scale
    var xNorm = (x - minValue) / (maxValue - minValue);
    // ease-out formula
    return Math.pow((-(xNorm - 1)), 4) + 1;
};
export var getcBackValue = function (circleValue, circleMinValue, circleMaxValue, circleMinSizePx, circleMaxSizePx) {
    if (circleMinSizePx === void 0) { circleMinSizePx = 50; }
    if (circleMaxSizePx === void 0) { circleMaxSizePx = 1000; }
    var cBackValue = 0;
    if (typeof circleValue !== "undefined" &&
        typeof circleMinValue !== "undefined" &&
        typeof circleMaxValue !== "undefined") {
        var mappedValue = void 0;
        if (circleMinValue <= circleValue && circleValue <= circleMaxValue)
            mappedValue = easeOut(circleValue, circleMinValue, circleMaxValue) * circleValue;
        else if (circleMinValue > circleValue)
            mappedValue = circleMinValue;
        else
            mappedValue = circleMaxValue;
        cBackValue =
            circleMinSizePx +
                ((mappedValue - circleMinValue) / (circleMaxValue - circleMinValue)) *
                    (circleMaxSizePx - circleMinSizePx);
    }
    return cBackValue;
};
//# sourceMappingURL=circle.js.map