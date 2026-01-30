import React, { useEffect } from "react";
import { View, TouchableOpacity } from "react-native";
import { Text, makeStyles } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
import { OptionIcon } from "./option-icon";
export var OptionSelector = function (_a) {
    var options = _a.options, selected = _a.selected, onSelect = _a.onSelect, style = _a.style, _b = _a.loading, loading = _b === void 0 ? false : _b;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    useEffect(function () {
        if (!selected && !loading) {
            var activeOptions = options.filter(function (o) { return o.active !== false; });
            var recommended = activeOptions.find(function (o) { return o.recommended; });
            if (recommended) {
                onSelect(recommended.value);
                return;
            }
            if (activeOptions.length > 0) {
                onSelect(activeOptions[0].value);
            }
        }
    }, [selected, options, onSelect, loading]);
    return (<View style={[styles.fieldContainer, style]}>
      {options
            .filter(function (option) { return option.active !== false; })
            .map(function (option) {
            var isSelected = selected === option.value;
            return (<TouchableOpacity key={option.value} onPress={function () { return onSelect(option.value); }} style={[
                    styles.fieldBackground,
                    isSelected && styles.fieldBackgroundSelected,
                ]}>
              <View style={styles.contentContainer}>
                <View style={styles.labelWithRecommended}>
                  <Text style={[styles.label, isSelected && styles.labelSelected]}>
                    {option.label}
                  </Text>
                  {option.recommended && (<Text style={[
                        styles.recommended,
                        isSelected && styles.recommendedSelected,
                    ]}>
                      ({LL.common.recommended()})
                    </Text>)}
                </View>

                <OptionIcon ionicon={option.ionicon} icon={option.icon} isSelected={isSelected}/>
              </View>
            </TouchableOpacity>);
        })}
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        fieldContainer: {
            flexDirection: "column",
            rowGap: 12,
        },
        fieldBackground: {
            flexDirection: "row",
            alignItems: "center",
            borderStyle: "solid",
            backgroundColor: colors.grey5,
            paddingHorizontal: 16,
            borderRadius: 12,
            minHeight: 56,
            borderWidth: 1.5,
        },
        fieldBackgroundSelected: {
            backgroundColor: colors.grey4,
        },
        contentContainer: {
            flex: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        label: {
            fontSize: 20,
            fontWeight: "500",
        },
        labelSelected: {
            color: colors.primary,
        },
        iconContainer: {
            marginLeft: 16,
            alignItems: "center",
            justifyContent: "center",
        },
        labelWithRecommended: {
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
        },
        recommended: {
            fontStyle: "italic",
            fontSize: 15,
            fontWeight: "400",
            marginLeft: 8,
            color: colors.grey2,
        },
        recommendedSelected: {
            color: colors.primary,
        },
    });
});
//# sourceMappingURL=option-selector.js.map