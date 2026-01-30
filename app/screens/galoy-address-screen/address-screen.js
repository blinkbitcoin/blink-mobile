var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import React from "react";
import { View } from "react-native";
import { gql } from "@apollo/client";
import { Screen } from "@app/components/screen";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { getLightningAddress, getPosUrl, getPrintableQrCodeUrl, } from "@app/utils/pay-links";
import { makeStyles, Text } from "@rn-vui/themed";
import { useAddressScreenQuery } from "../../graphql/generated";
import AddressComponent from "./address-component";
import { AddressExplainerModal } from "./address-explainer-modal";
import { PayCodeExplainerModal } from "./paycode-explainer-modal";
import { PosExplainerModal } from "./pos-explainer-modal";
var useStyles = makeStyles(function () { return ({
    container: {
        padding: 20,
    },
    addressInfoContainer: {
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 32,
        rowGap: 60,
    },
    buttonContainerStyle: {
        marginTop: 20,
    },
}); });
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query addressScreen {\n    me {\n      id\n      username\n    }\n  }\n"], ["\n  query addressScreen {\n    me {\n      id\n      username\n    }\n  }\n"])));
export var GaloyAddressScreen = function () {
    var _a;
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var styles = useStyles();
    var data = useAddressScreenQuery({
        fetchPolicy: "cache-first",
        skip: !isAuthed,
    }).data;
    var appConfig = useAppConfig().appConfig;
    var _b = React.useState(false), explainerModalVisible = _b[0], setExplainerModalVisible = _b[1];
    var _c = React.useState(false), isPosExplainerModalOpen = _c[0], setIsPosExplainerModalOpen = _c[1];
    var _d = React.useState(false), isPaycodeExplainerModalOpen = _d[0], setIsPaycodeExplainerModalOpen = _d[1];
    var username = ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) || "";
    var lightningAddress = getLightningAddress(appConfig.galoyInstance.lnAddressHostname, username);
    var posUrl = getPosUrl(appConfig.galoyInstance.posUrl, username);
    var payCodeUrl = getPrintableQrCodeUrl(appConfig.galoyInstance.posUrl, username);
    var togglePosExplainerModal = function () {
        setIsPosExplainerModalOpen(!isPosExplainerModalOpen);
    };
    var togglePaycodeExplainerModal = function () {
        setIsPaycodeExplainerModalOpen(!isPaycodeExplainerModalOpen);
    };
    var toggleExplainerModal = function () {
        setExplainerModalVisible(!explainerModalVisible);
    };
    return (<Screen preset="scroll">
      <View style={styles.container}>
        {username && (<>
            <Text type={"h1"} bold>
              {LL.GaloyAddressScreen.title()}
            </Text>
            <View style={styles.addressInfoContainer}>
              <AddressComponent addressType={"lightning"} address={lightningAddress} title={LL.GaloyAddressScreen.yourLightningAddress()} onToggleDescription={toggleExplainerModal}/>
              <AddressComponent addressType={"pos"} address={posUrl} title={LL.GaloyAddressScreen.yourCashRegister()} useGlobeIcon={true} onToggleDescription={togglePosExplainerModal}/>
              <AddressComponent addressType={"paycode"} address={payCodeUrl} title={LL.GaloyAddressScreen.yourPaycode()} useGlobeIcon={true} onToggleDescription={togglePaycodeExplainerModal}/>
            </View>
          </>)}
      </View>
      <AddressExplainerModal modalVisible={explainerModalVisible} toggleModal={toggleExplainerModal}/>
      <PosExplainerModal modalVisible={isPosExplainerModalOpen} toggleModal={togglePosExplainerModal}/>
      <PayCodeExplainerModal modalVisible={isPaycodeExplainerModalOpen} toggleModal={togglePaycodeExplainerModal}/>
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=address-screen.js.map