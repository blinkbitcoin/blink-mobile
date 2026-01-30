import React, { useEffect } from "react";
import { View } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { Screen } from "@app/components/screen";
import { SuccessIconAnimation, CompletedTextAnimation, } from "@app/components/success-animation";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles } from "@rn-vui/themed";
export var ConversionSuccessScreen = function () {
    var styles = useStyles();
    var navigation = useNavigation();
    var LL = useI18nContext().LL;
    var CALLBACK_DELAY = 3000;
    useEffect(function () {
        var navigateToHomeTimeout = setTimeout(navigation.popToTop, CALLBACK_DELAY);
        return function () { return clearTimeout(navigateToHomeTimeout); };
    }, [navigation]);
    return (<Screen preset="scroll" style={styles.screen}>
      <View style={styles.container}>
        <SuccessIconAnimation>
          <GaloyIcon name={"payment-success"} size={128}/>
        </SuccessIconAnimation>
        <CompletedTextAnimation>
          <Text type="h2" style={styles.successText}>
            {LL.ConversionSuccessScreen.message()}
          </Text>
        </CompletedTextAnimation>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    successText: {
        marginTop: 20,
    },
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    screen: {
        flexGrow: 1,
    },
}); });
//# sourceMappingURL=conversion-success-screen.js.map