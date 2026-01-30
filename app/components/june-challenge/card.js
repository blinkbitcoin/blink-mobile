import { useEffect, useState } from "react";
import { View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { JUNE_1_2024_12_AM_UTC_MINUS_6, getTimeLeft, JULY_1_2024_12_AM_UTC_MINUS_6, } from "@app/utils/date";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
import { PressableCard } from "../pressable-card";
import { JuneChallengeModal } from "./modal";
export var JuneChallengeCard = function () {
    var _a = useState(false), modalIsOpen = _a[0], setModalIsOpen = _a[1];
    var openModal = function () { return setModalIsOpen(true); };
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var _b = useState(getTimeLeft({
        after: JUNE_1_2024_12_AM_UTC_MINUS_6,
        until: JULY_1_2024_12_AM_UTC_MINUS_6,
    })), countDown = _b[0], setCountDown = _b[1];
    useEffect(function () {
        var dateNow = Date.now();
        if (dateNow > JULY_1_2024_12_AM_UTC_MINUS_6)
            return;
        var t = setInterval(function () {
            setCountDown(getTimeLeft({
                after: JUNE_1_2024_12_AM_UTC_MINUS_6,
                until: JULY_1_2024_12_AM_UTC_MINUS_6,
            }));
        }, 1000);
        return function () { return clearInterval(t); };
    }, [setCountDown]);
    var currentTime = Date.now();
    if (currentTime > JULY_1_2024_12_AM_UTC_MINUS_6 ||
        currentTime < JUNE_1_2024_12_AM_UTC_MINUS_6)
        return <></>;
    return (<PressableCard onPress={openModal}>
      <JuneChallengeModal isVisible={modalIsOpen} setIsVisible={setModalIsOpen}/>
      <View style={styles.card}>
        <View style={styles.textContainer}>
          <View style={styles.beside}>
            <Text type="p1" bold>
              {LL.Circles.juneChallenge.title()}
            </Text>
            <Text color={colors.grey3}>{countDown}</Text>
          </View>
          <Text type="p2">{LL.Circles.juneChallenge.description()}</Text>
        </View>
        <View>
          <GaloyIcon color={colors.primary} size={28} name="rank"/>
        </View>
      </View>
    </PressableCard>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        card: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 16,
            borderRadius: 10,
            backgroundColor: colors.grey5,
        },
        textContainer: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            rowGap: 6,
        },
        beside: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            columnGap: 10,
        },
    });
});
//# sourceMappingURL=card.js.map