import * as React from "react";
import { Text, View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@rn-vui/base";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { CloseCross } from "../../components/close-cross";
import { MountainHeader } from "../../components/mountain-header";
import { Screen } from "../../components/screen";
import BadgerShovelBitcoin from "./badger-shovel-01.svg";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        bottomView: {
            backgroundColor: colors._lightBlue,
            flex: 1,
        },
        buttonStyle: {
            backgroundColor: colors._white,
            borderRadius: 32,
            marginTop: 24,
            width: "100%",
        },
        container: {
            alignItems: "center",
            backgroundColor: colors._lightBlue,
            flexGrow: 1,
        },
        divider: { flex: 0.5, minHeight: 30 },
        headerSection: {
            color: colors._white,
            fontSize: 16,
            paddingTop: 18,
        },
        titleSection: {
            color: colors._white,
            fontSize: 24,
            fontWeight: "bold",
            paddingTop: 6,
        },
        titleStyle: {
            color: colors._lightBlue,
            fontSize: 18,
            fontWeight: "bold",
            flex: 1,
            justifyContent: "center",
        },
    });
});
export var SectionCompleted = function (_a) {
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var _b = route.params, amount = _b.amount, sectionTitle = _b.sectionTitle, isAvailable = _b.isAvailable;
    var LL = useI18nContext().LL;
    return (<Screen backgroundColor={colors._orange} unsafe>
      <MountainHeader amount={amount.toString()} color={colors._orange} isAvailable={isAvailable}/>
      <View style={styles.container}>
        <View style={styles.divider}/>
        <BadgerShovelBitcoin />
        <Text style={styles.headerSection}>{LL.EarnScreen.sectionsCompleted()}</Text>
        <Text style={styles.titleSection}>{sectionTitle}</Text>
        <Button title={LL.EarnScreen.keepDigging()} type="solid" buttonStyle={styles.buttonStyle} titleStyle={styles.titleStyle} onPress={function () { return navigation.navigate("Earn"); }}/>
      </View>
      <View style={styles.bottomView}/>
      <CloseCross color={colors._white} onPress={function () { return navigation.navigate("Earn"); }}/>
    </Screen>);
};
//# sourceMappingURL=section-completed.js.map