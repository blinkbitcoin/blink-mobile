import { useEffect, useState } from "react";
import { View } from "react-native";
import { useApolloClient } from "@apollo/client";
import PeopleIcon from "@app/assets/icons/people.svg";
import { setInnerCircleCachedValue } from "@app/graphql/client-only-query";
import { useCirclesQuery, useInnerCircleValueQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { makeStyles } from "@rn-vui/themed";
export var PeopleTabIcon = function (_a) {
    var color = _a.color, focused = _a.focused;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var _b = useState(true), hidden = _b[0], setHidden = _b[1];
    var cachedData = useInnerCircleValueQuery().data;
    var networkData = useCirclesQuery({
        fetchPolicy: "cache-first",
    }).data;
    var client = useApolloClient();
    useEffect(function () {
        var _a, _b, _c;
        var innerCircleCachedValue = (cachedData === null || cachedData === void 0 ? void 0 : cachedData.innerCircleValue) || -1;
        var innerCircleRealValue = ((_c = (_b = (_a = networkData === null || networkData === void 0 ? void 0 : networkData.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.welcomeProfile) === null || _c === void 0 ? void 0 : _c.innerCircleAllTimeCount) || -1;
        if (innerCircleCachedValue === -1 && innerCircleRealValue === -1) {
            setHidden(false);
            setInnerCircleCachedValue(client, 0);
            return;
        }
        setHidden(innerCircleRealValue === innerCircleCachedValue);
        setInnerCircleCachedValue(client, innerCircleRealValue);
    }, [cachedData, networkData, setHidden, client]);
    return (<View>
      {!hidden && (<>
          <View style={[
                styles.notificationDot,
                focused ? styles.notificationDotHighlight : {},
            ]}/>
          <View style={[
                styles.notificationRing,
                focused ? styles.notificationRingHighlight : {},
            ]}/>
        </>)}
      <PeopleIcon {...testProps(LL.PeopleScreen.title())} color={color}/>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        notificationDot: {
            position: "absolute",
            right: -6,
            top: -1,
            zIndex: 10,
            height: 4,
            width: 4,
            borderRadius: 2,
            backgroundColor: colors.grey2,
        },
        notificationDotHighlight: {
            backgroundColor: colors.primary,
        },
        notificationRing: {
            position: "absolute",
            right: -8,
            top: -3,
            zIndex: 10,
            height: 8,
            width: 8,
            borderRadius: 5,
            borderColor: colors.grey2,
            borderWidth: 1,
        },
        notificationRingHighlight: {
            borderColor: colors.primary,
        },
    });
});
//# sourceMappingURL=tab-icon.js.map