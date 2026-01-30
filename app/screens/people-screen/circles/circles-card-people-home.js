import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useCountUp } from "use-count-up";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { getcBackValue } from "@app/components/circle";
import { PressableCard } from "@app/components/pressable-card";
import { useCirclesQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { makeStyles, Text } from "@rn-vui/themed";
export var CirclesCardPeopleHome = function () {
    var _a, _b;
    var styles = useStyles();
    var navigation = useNavigation();
    var LL = useI18nContext().LL;
    var _c = useCirclesQuery({
        fetchPolicy: "cache-and-network",
    }), data = _c.data, loading = _c.loading, refetch = _c.refetch;
    useFocusEffect(useCallback(function () {
        refetch();
    }, [refetch]));
    var peopleInInnerCircle = ((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.welcomeProfile) === null || _b === void 0 ? void 0 : _b.innerCircleAllTimeCount) || 0;
    var isLonely = peopleInInnerCircle === 0;
    var _d = useState(peopleInInnerCircle), prevInnerCircleCount = _d[0], setPrevInnerCircleCount = _d[1];
    var _e = useCountUp({
        isCounting: true,
        start: prevInnerCircleCount,
        end: peopleInInnerCircle,
        duration: 1.2,
        onComplete: function () {
            setPrevInnerCircleCount(peopleInInnerCircle);
        },
    }), peopleInInnerCircleCountUp = _e.value, reset = _e.reset;
    useEffect(function () {
        if (prevInnerCircleCount !== peopleInInnerCircle) {
            reset();
        }
    }, [prevInnerCircleCount, peopleInInnerCircle, reset]);
    var cBackValue = getcBackValue(Number(peopleInInnerCircleCountUp), 1, 100, 250, 360);
    var cBackStyles = {
        height: cBackValue,
        width: cBackValue,
        borderRadius: cBackValue / 2,
    };
    var openBlinkCirclesDashboard = function () { return navigation.navigate("circlesDashboard"); };
    return (<PressableCard onPress={openBlinkCirclesDashboard}>
      <View style={styles.container}>
        <View>
          <View style={styles.blinkCircles}>
            <Text type="h2">{LL.Circles.titleBlinkCircles()}</Text>
            <View style={styles.loadingInfoContainer}>
              {loading && (<View style={styles.loadingView}>
                  <Text type={"p3"}>{LL.Circles.fetchingLatestCircles()}</Text>
                  <ActivityIndicator />
                </View>)}
            </View>
          </View>
          <View style={styles.separator}></View>
        </View>
        <View>
          <Text type={isLonely ? "p1" : "p2"} style={styles.textCenter}>
            {LL.Circles.circlesExplainer()}
          </Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsNumber}>{peopleInInnerCircleCountUp}</Text>
          <Text style={styles.pointsText} type="p2">
            {LL.Circles.peopleYouWelcomed()}
          </Text>
        </View>
        <GaloySecondaryButton style={styles.viewCirclescta} title={LL.Circles.viewMyCircles()} onPress={openBlinkCirclesDashboard}/>
        <View style={[styles.backdropCircle, cBackStyles]}></View>
      </View>
    </PressableCard>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "column",
            marginBottom: 20,
            borderRadius: 12,
            padding: 12,
            paddingBottom: 0,
            rowGap: 14,
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
        },
        loadingInfoContainer: {
            justifyContent: "center",
            alignItems: "center",
            minHeight: 20,
        },
        loadingView: {
            flexDirection: "row",
            columnGap: 10,
        },
        blinkCircles: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        separator: {
            height: 1,
            backgroundColor: colors.grey4,
            marginTop: 8,
        },
        textCenter: {
            textAlign: "center",
        },
        pointsContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            columnGap: 10,
            minHeight: 62,
        },
        pointsNumber: {
            color: colors.black,
            fontWeight: "700",
            fontSize: 50,
        },
        pointsText: {
            paddingBottom: 8,
            maxWidth: 80,
        },
        backdropCircle: {
            position: "absolute",
            right: -150,
            bottom: -150,
            backgroundColor: colors.backdropWhite,
            zIndex: -10,
        },
        viewCirclescta: {
            marginTop: -10,
        },
    });
});
//# sourceMappingURL=circles-card-people-home.js.map