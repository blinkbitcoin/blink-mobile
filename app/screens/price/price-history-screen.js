var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import * as React from "react";
import { gql } from "@apollo/client";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { usePriceHistoryScreenQuery } from "@app/graphql/generated";
import { useLevel } from "@app/graphql/level-context";
import { useAppConfig } from "@app/hooks/use-app-config";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import { useNavigation } from "@react-navigation/native";
import { makeStyles } from "@rn-vui/themed";
import { PriceHistory } from "../../components/price-history";
import { Screen } from "../../components/screen";
var useStyles = makeStyles(function (_theme) { return ({
    screen: { flex: 1 },
    button: { margin: 20 },
}); });
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query priceHistoryScreen {\n    me {\n      id\n      defaultAccount {\n        id\n      }\n    }\n  }\n"], ["\n  query priceHistoryScreen {\n    me {\n      id\n      defaultAccount {\n        id\n      }\n    }\n  }\n"])));
export var PriceHistoryScreen = function () {
    var _a, _b;
    var navigate = useNavigation().navigate;
    var LL = useI18nContext().LL;
    var fiatUrl = useAppConfig().appConfig.galoyInstance.fiatUrl;
    var data = usePriceHistoryScreenQuery().data;
    var accountId = (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.id;
    var isAtLeastLevelTwo = useLevel().isAtLeastLevelTwo;
    var _c = React.useState(fiatUrl), urlWebView = _c[0], setUrlWebView = _c[1];
    React.useEffect(function () {
        setUrlWebView("".concat(fiatUrl, "?accountId=").concat(accountId));
    }, [accountId, fiatUrl]);
    var styles = useStyles();
    return (<Screen preset="scroll" style={styles.screen}>
      <PriceHistory />
      {(isAtLeastLevelTwo || !isIos) && (<GaloyPrimaryButton title={LL.PriceHistoryScreen.buyAndSell()} onPress={function () {
                return navigate("webView", {
                    url: urlWebView,
                    initialTitle: LL.PriceHistoryScreen.buyAndSell(),
                });
            }} containerStyle={styles.button}/>)}
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=price-history-screen.js.map