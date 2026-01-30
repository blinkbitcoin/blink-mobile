import { View } from "react-native";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { PressableCard } from "@app/components/pressable-card";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles, Text } from "@rn-vui/themed";
import { useCirclesCard } from "./use-circles-card";
export var ShareCircles = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var _a = useCirclesCard(), ShareImg = _a.ShareImg, share = _a.share;
    return (<>
      {ShareImg}
      <PressableCard onPress={share}>
        <View style={styles.container}>
          <Text type="p1">{LL.Circles.shareCircles()}</Text>
          <View style={styles.iconContainer}>
            <GaloyIconButton name="share" size="medium" iconOnly onPress={share}/>
          </View>
        </View>
      </PressableCard>
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "row",
            borderRadius: 12,
            padding: 12,
            columnGap: 4,
            alignItems: "center",
            justifyContent: "space-between",
        },
        iconContainer: {
            display: "flex",
            flexDirection: "row",
            columnGap: 10,
        },
    });
});
//# sourceMappingURL=share-circles-card.js.map