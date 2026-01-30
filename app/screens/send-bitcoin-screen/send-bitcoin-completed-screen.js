import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Alert, ScrollView } from "react-native";
import InAppReview from "react-native-in-app-review";
import ViewShot from "react-native-view-shot";
import { useApolloClient } from "@apollo/client";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { Screen } from "@app/components/screen";
import { CompletedTextAnimation, SuccessIconAnimation, } from "@app/components/success-animation";
import { SuccessActionComponent } from "@app/components/success-action";
import { setFeedbackModalShown } from "@app/graphql/client-only-query";
import { useFeedbackModalShownQuery, useSettingsScreenQuery, } from "@app/graphql/generated";
import { useAppConfig, useScreenshot } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { logAppFeedback } from "@app/utils/analytics";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { SuggestionModal } from "./suggestion-modal";
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg";
import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { SuccessActionTag } from "@app/components/success-action/success-action";
import { utils } from "lnurl-pay";
import { formatUnixTimestampYMDHM } from "@app/utils/date";
import { formatTimeToMempool, timeToMempool, } from "../transaction-detail-screen/format-time";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { PaymentType } from "@blinkbitcoin/blink-client";
var FEEDBACK_DELAY = 3000;
var processStatus = function (_a) {
    var status = _a.status, arrivalAtMempoolEstimate = _a.arrivalAtMempoolEstimate;
    if (status === "SUCCESS")
        return "SUCCESS";
    return arrivalAtMempoolEstimate ? "QUEUED" : "PENDING";
};
var formatPaymentType = function (_a) {
    var blinkToBlinkLabel = _a.blinkToBlinkLabel, paymentType = _a.paymentType;
    return paymentType === PaymentType.Intraledger ? blinkToBlinkLabel : paymentType !== null && paymentType !== void 0 ? paymentType : "";
};
var useSuccessMessage = function (successAction, preimage) {
    return useCallback(function () {
        if (!successAction)
            return "";
        var tag = successAction.tag, message = successAction.message, description = successAction.description, url = successAction.url;
        var decryptedMessage = tag === SuccessActionTag.AES && preimage
            ? utils.decipherAES({ successAction: successAction, preimage: preimage })
            : null;
        var textContent = [message, description, decryptedMessage].filter(Boolean).join(" ");
        var includeUrl = url && !textContent.includes(url);
        return includeUrl ? "".concat(textContent, " ").concat(url).trim() : textContent;
    }, [successAction, preimage])();
};
var useFeedbackHandler = function () {
    var client = useApolloClient();
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var _a = useState(false), showSuggestionModal = _a[0], setShowSuggestionModal = _a[1];
    var handleNegativeFeedback = useCallback(function () {
        logAppFeedback({ isEnjoingApp: false });
        setShowSuggestionModal(true);
    }, []);
    var handlePositiveFeedback = useCallback(function () {
        logAppFeedback({ isEnjoingApp: true });
        InAppReview.RequestInAppReview();
    }, []);
    var requestFeedback = useCallback(function () {
        if (!shouldShowFeedback(appConfig))
            return;
        if (InAppReview.isAvailable()) {
            showFeedbackAlert(LL, handleNegativeFeedback, handlePositiveFeedback);
            setFeedbackModalShown(client, true);
        }
    }, [LL, client, appConfig, handleNegativeFeedback, handlePositiveFeedback]);
    return { requestFeedback: requestFeedback, showSuggestionModal: showSuggestionModal, setShowSuggestionModal: setShowSuggestionModal };
};
var shouldShowFeedback = function (appConfig) {
    return appConfig && appConfig.galoyInstance.id !== "Local";
};
var showFeedbackAlert = function (LL, onNegative, onPositive) {
    Alert.alert("", LL.support.enjoyingApp(), [
        { text: LL.common.No(), onPress: onNegative },
        { text: LL.common.yes(), onPress: onPositive },
    ], { cancelable: true });
};
var SuccessIconComponent = function (_a) {
    var status = _a.status, arrivalAtMempoolEstimate = _a.arrivalAtMempoolEstimate;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var _b = useI18nContext(), LL = _b.LL, locale = _b.locale;
    var getStatusIcon = function () {
        var iconMap = {
            SUCCESS: function () { return <GaloyIcon name="payment-success" size={100}/>; },
            QUEUED: function () { return <GaloyIcon name="payment-pending" size={100}/>; },
            PENDING: function () { return <GaloyIcon name="warning" color={colors._orange} size={100}/>; },
        };
        return iconMap[status]();
    };
    var getStatusText = function () {
        var textMap = {
            SUCCESS: function () { return LL.SendBitcoinScreen.success(); },
            QUEUED: function () {
                return LL.TransactionDetailScreen.txNotBroadcast({
                    countdown: formatTimeToMempool(timeToMempool(arrivalAtMempoolEstimate), LL, locale),
                });
            },
            PENDING: function () { return LL.SendBitcoinScreen.pendingPayment(); },
        };
        return textMap[status]();
    };
    return (<View style={styles.successViewContainer} {...testProps("Success Text")}>
      <SuccessIconAnimation>{getStatusIcon()}</SuccessIconAnimation>
      <CompletedTextAnimation>
        <Text style={styles.completedText} {...testProps(status)} type={"p2"}>
          {getStatusText()}
        </Text>
      </CompletedTextAnimation>
    </View>);
};
var PaymentDetailsSection = function (_a) {
    var currencyAmount = _a.currencyAmount, satAmount = _a.satAmount, satFeeAmount = _a.satFeeAmount, currencyFeeAmount = _a.currencyFeeAmount, usernameTitle = _a.usernameTitle, destination = _a.destination, createdAt = _a.createdAt, paymentType = _a.paymentType, LL = _a.LL;
    var styles = useStyles();
    return (<>
      <View style={styles.successActionFieldContainer}>
        <SuccessActionComponent title={LL.SendBitcoinScreen.amount()} text={currencyAmount} subValue={satAmount} key="amount" visible={Boolean(currencyAmount)}/>
        <SuccessActionComponent title={LL.SendBitcoinScreen.feeLabel()} text={currencyFeeAmount} subValue={satFeeAmount} key="fee" visible={Boolean(currencyFeeAmount)}/>
        <SuccessActionComponent title={LL.SendBitcoinScreen.sender()} text={usernameTitle} key="sender" visible={Boolean(usernameTitle)}/>
        <SuccessActionComponent title={LL.SendBitcoinScreen.recipient()} text={destination} key="recipient" visible={Boolean(destination)}/>
      </View>

      <View style={styles.successActionFieldContainer}>
        <SuccessActionComponent title={LL.SendBitcoinScreen.time()} text={createdAt ? formatUnixTimestampYMDHM(createdAt) : ""} key="time" visible={Boolean(createdAt)}/>
        <SuccessActionComponent title={LL.SendBitcoinScreen.type()} text={formatPaymentType({
            blinkToBlinkLabel: LL.common.blinkToBlink(),
            paymentType: paymentType,
        })} key="type" visible={Boolean(paymentType)}/>
      </View>
    </>);
};
var NoteSection = function (_a) {
    var noteMessage = _a.noteMessage, LL = _a.LL;
    var styles = useStyles();
    if (!noteMessage)
        return null;
    return (<View style={styles.successActionFieldContainer}>
      <SuccessActionComponent title={LL.SendBitcoinScreen.noteLabel()} text={noteMessage} key="note" visible={Boolean(noteMessage)}/>
    </View>);
};
var HeaderSection = function (_a) {
    var isTakingScreenshot = _a.isTakingScreenshot, onClose = _a.onClose;
    var styles = useStyles();
    if (isTakingScreenshot)
        return null;
    return (<View style={styles.headerContainer}>
      <GaloyIconButton iconOnly size="large" name="close" onPress={onClose}/>
    </View>);
};
var SendBitcoinCompletedScreen = function (_a) {
    var _b, _c;
    var route = _a.route;
    var _d = useState(true), showSuccessIcon = _d[0], setShowSuccessIcon = _d[1];
    var viewRef = useRef(null);
    var _e = route.params, arrivalAtMempoolEstimate = _e.arrivalAtMempoolEstimate, statusRaw = _e.status, successAction = _e.successAction, preimage = _e.preimage, currencyAmount = _e.currencyAmount, satAmount = _e.satAmount, currencyFeeAmount = _e.currencyFeeAmount, satFeeAmount = _e.satFeeAmount, destination = _e.destination, paymentType = _e.paymentType, createdAt = _e.createdAt;
    var styles = useStyles();
    var mode = useTheme().theme.mode;
    var navigation = useNavigation();
    var LL = useI18nContext().LL;
    var feedbackShownData = useFeedbackModalShownQuery();
    var data = useSettingsScreenQuery({ fetchPolicy: "cache-first" }).data;
    var successIconDuration = useRemoteConfig().successIconDuration;
    var status = processStatus({ arrivalAtMempoolEstimate: arrivalAtMempoolEstimate, status: statusRaw });
    var usernameTitle = ((_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.username) || LL.common.blinkUser();
    var noteMessage = useSuccessMessage(successAction, preimage);
    var Logo = mode === "dark" ? LogoDarkMode : LogoLightMode;
    var _f = useFeedbackHandler(), requestFeedback = _f.requestFeedback, showSuggestionModal = _f.showSuggestionModal, setShowSuggestionModal = _f.setShowSuggestionModal;
    var _g = useScreenshot(viewRef), isTakingScreenshot = _g.isTakingScreenshot, captureAndShare = _g.captureAndShare;
    useEffect(function () {
        var timer = setTimeout(function () { return setShowSuccessIcon(false); }, successIconDuration);
        return function () { return clearTimeout(timer); };
    }, [successIconDuration]);
    useEffect(function () {
        var _a;
        var feedbackModalShown = (_a = feedbackShownData === null || feedbackShownData === void 0 ? void 0 : feedbackShownData.data) === null || _a === void 0 ? void 0 : _a.feedbackModalShown;
        if (!feedbackModalShown) {
            var feedbackTimeout_1 = setTimeout(requestFeedback, FEEDBACK_DELAY);
            return function () { return clearTimeout(feedbackTimeout_1); };
        }
    }, [(_c = feedbackShownData === null || feedbackShownData === void 0 ? void 0 : feedbackShownData.data) === null || _c === void 0 ? void 0 : _c.feedbackModalShown, requestFeedback]);
    var handleNavigateHome = function () { return navigation.navigate("Primary"); };
    if (showSuccessIcon) {
        return (<Screen headerShown={false}>
        <SuccessIconComponent status={status} arrivalAtMempoolEstimate={arrivalAtMempoolEstimate}/>
      </Screen>);
    }
    return (<Screen headerShown={false}>
      <HeaderSection isTakingScreenshot={isTakingScreenshot} onClose={handleNavigateHome}/>

      <ViewShot ref={viewRef} style={styles.viewShot}>
        <View style={styles.screenContainer}>
          <Logo height={110}/>

          <View style={styles.container}>
            <ScrollView>
              <PaymentDetailsSection currencyAmount={currencyAmount} satAmount={satAmount} satFeeAmount={satFeeAmount} currencyFeeAmount={currencyFeeAmount} usernameTitle={usernameTitle} destination={destination} createdAt={createdAt} paymentType={paymentType} LL={LL}/>

              <NoteSection noteMessage={noteMessage} LL={LL}/>
            </ScrollView>
          </View>

          {!isTakingScreenshot && (<GaloyPrimaryButton style={styles.shareButton} onPress={captureAndShare} title={LL.common.share()} underlayColor="transparent"/>)}
        </View>
      </ViewShot>

      <SuggestionModal navigation={navigation} showSuggestionModal={showSuggestionModal} setShowSuggestionModal={setShowSuggestionModal}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        headerContainer: {
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: 16,
            paddingBottom: 6,
        },
        screenContainer: {
            flexGrow: 1,
            marginHorizontal: 20,
        },
        viewShot: {
            flexGrow: 1,
        },
        completedText: {
            textAlign: "center",
            marginTop: 20,
            marginHorizontal: 28,
        },
        container: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 20,
        },
        shareButton: {
            marginTop: 10,
            marginBottom: 20,
        },
        successActionFieldContainer: {
            overflow: "hidden",
            gap: 20,
            backgroundColor: colors.grey5,
            borderRadius: 10,
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 14,
            marginBottom: 12,
        },
        successViewContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
    });
});
export default SendBitcoinCompletedScreen;
//# sourceMappingURL=send-bitcoin-completed-screen.js.map