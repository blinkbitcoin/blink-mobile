import React, { useMemo } from "react";
import { ActivityIndicator, TouchableOpacity, View, } from "react-native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "@app/utils/testProps";
var DEFAULT_OPTIONS = [25, 50, 75, 100];
var DEFAULT_TEST_ID_PREFIX = "convert";
export var PercentageSelector = function (_a) {
    var isLocked = _a.isLocked, loadingPercent = _a.loadingPercent, onSelect = _a.onSelect, options = _a.options, _b = _a.testIdPrefix, testIdPrefix = _b === void 0 ? DEFAULT_TEST_ID_PREFIX : _b, containerStyle = _a.containerStyle;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var opts = useMemo(function () { return (options && options.length ? options : DEFAULT_OPTIONS); }, [options]);
    return (<View style={[styles.row, containerStyle]}>
      {opts.map(function (p) {
            var loading = loadingPercent === p;
            return (<TouchableOpacity key={p} {...testProps("".concat(testIdPrefix, "-").concat(p, "%"))} style={[styles.chip, isLocked && styles.chipDisabled]} disabled={isLocked} onPress={function () { return onSelect(p); }} accessibilityLabel={testIdPrefix}>
            {loading ? (<ActivityIndicator color={colors.primary}/>) : (<Text style={styles.chipText}>{p}%</Text>)}
          </TouchableOpacity>);
        })}
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        row: {
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            width: "100%",
        },
        chip: {
            backgroundColor: colors.grey5,
            borderRadius: 100,
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 16,
            minWidth: 64,
        },
        chipDisabled: {
            opacity: 0.5,
        },
        chipText: {
            color: colors.primary,
            fontWeight: "bold",
        },
    });
});
//# sourceMappingURL=percentage-selector.js.map