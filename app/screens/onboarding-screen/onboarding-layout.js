import * as React from "react";
import { View, FlatList } from "react-native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@app/components/screen";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
export var OnboardingLayout = function (_a) {
    var title = _a.title, descriptions = _a.descriptions, customContent = _a.customContent, iconName = _a.iconName, primaryLabel = _a.primaryLabel, onPrimaryAction = _a.onPrimaryAction, secondaryLabel = _a.secondaryLabel, onSecondaryAction = _a.onSecondaryAction, _b = _a.primaryLoading, primaryLoading = _b === void 0 ? false : _b, _c = _a.secondaryLoading, secondaryLoading = _c === void 0 ? false : _c;
    var colors = useTheme().theme.colors;
    var insets = useSafeAreaInsets();
    var styles = useStyles(insets);
    var hasDescriptions = Boolean(descriptions === null || descriptions === void 0 ? void 0 : descriptions.length);
    return (<Screen style={styles.screenStyle}>
      <View style={styles.content}>
        <View>
          {title && (<Text type="h2" style={styles.title}>
              {title}
            </Text>)}

          <View style={styles.descriptionList}>
            {hasDescriptions && (<FlatList accessibilityRole="list" data={descriptions} keyExtractor={function (_, i) { return String(i); }} scrollEnabled={false} renderItem={function (_a) {
                var item = _a.item;
                return (<View accessible accessibilityLabel={"\u2022 ".concat(item)} style={styles.descriptionItem}>
                    <Text type="h2" style={styles.descriptionBullet}>
                      •
                    </Text>
                    <Text type="h2" style={styles.descriptionText}>
                      {item}
                    </Text>
                  </View>);
            }}/>)}

            {customContent && (<View style={hasDescriptions && styles.customContent}>{customContent}</View>)}
          </View>
        </View>

        {iconName && (<View style={styles.iconWrapper}>
            <GaloyIcon name={iconName} color={colors.primary} size={110}/>
          </View>)}

        <View style={styles.bottom}>
          <GaloyPrimaryButton title={primaryLabel} onPress={onPrimaryAction} loading={primaryLoading}/>
          {secondaryLabel && onSecondaryAction && (<GaloySecondaryButton title={secondaryLabel} onPress={onSecondaryAction} loading={secondaryLoading} containerStyle={styles.secondaryButtonContainer}/>)}
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            flex: 1,
        },
        content: {
            flex: 1,
            padding: 20,
        },
        secondaryButtonContainer: {
            marginTop: 15,
            marginBottom: -15,
        },
        title: {
            paddingHorizontal: 5,
            marginBottom: 16,
        },
        descriptionList: {
            paddingHorizontal: 5,
            paddingBottom: 20,
        },
        descriptionItem: {
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "flex-start",
        },
        descriptionBullet: {
            color: colors.grey2,
            marginRight: 8,
            lineHeight: 22,
        },
        descriptionText: {
            color: colors.grey2,
            flex: 1,
            flexWrap: "wrap",
            lineHeight: 22,
        },
        customContent: {
            marginTop: 10,
        },
        bottom: {
            flex: 1,
            justifyContent: "flex-end",
            paddingBottom: 10,
        },
        iconWrapper: {
            position: "absolute",
            justifyContent: "center",
            alignItems: "center",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
    });
});
//# sourceMappingURL=onboarding-layout.js.map