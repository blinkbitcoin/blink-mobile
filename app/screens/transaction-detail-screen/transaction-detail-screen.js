import * as React from "react";
import { Linking, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/Ionicons";
import { useFragment } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { TransactionDate } from "@app/components/transaction-date";
import { useDescriptionDisplay } from "@app/components/transaction-item";
import { WalletSummary } from "@app/components/wallet-summary";
import { TransactionFragmentDoc, useTransactionListForDefaultAccountLazyQuery, useHomeAuthedQuery, WalletCurrency, } from "@app/graphql/generated";
import { useAppConfig, useTransactionSeenState } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toWalletAmount } from "@app/types/amounts";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { IconTransaction } from "../../components/icon-transactions";
import { Screen } from "../../components/screen";
import { formatTimeToMempool, timeToMempool } from "./format-time";
var Row = function (_a) {
    var entry = _a.entry, value = _a.value, content = _a.content, _b = _a.icons, icons = _b === void 0 ? [] : _b;
    var styles = useStyles();
    return (<View style={styles.description}>
      <View style={styles.container}>
        <Text style={styles.entry} selectable={false}>
          {entry}
        </Text>
      </View>
      {content ? (content) : (<View style={styles.valueContainer}>
          <Text selectable={false} style={styles.value}>
            {value}
          </Text>
          {icons.length > 0 && (<View style={styles.valueIcons}>
              {icons.map(function (icon, index) { return (<React.Fragment key={index}>{icon}</React.Fragment>); })}
            </View>)}
        </View>)}
    </View>);
};
var typeDisplay = function (instance) {
    if (!instance || !instance.__typename) {
        return "Unknown";
    }
    switch (instance.__typename) {
        case "SettlementViaOnChain":
            return "OnChain";
        case "SettlementViaLn":
            return "Lightning";
        case "SettlementViaIntraLedger":
            return "IntraLedger";
        default:
            return "Unknown";
    }
};
export var TransactionDetailScreen = function (_a) {
    var _b, _c, _d, _e, _f;
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var insets = useSafeAreaInsets();
    var navigation = useNavigation();
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var galoyInstance = useAppConfig().appConfig.galoyInstance;
    var txid = route.params.txid;
    var homeData = useHomeAuthedQuery({ fetchPolicy: "cache-only" }).data;
    var viewInExplorer = function (hash) {
        return Linking.openURL(galoyInstance.blockExplorer + hash);
    };
    var viewInLightningDecoder = function (invoice) {
        return Linking.openURL("https://dev.blink.sv/decode?invoice=" + invoice);
    };
    var tx = useFragment({
        fragment: TransactionFragmentDoc,
        fragmentName: "Transaction",
        from: {
            __typename: "Transaction",
            id: txid,
        },
    }).data;
    var refetch = useTransactionListForDefaultAccountLazyQuery({
        fetchPolicy: "network-only",
    })[0];
    var _g = React.useState(0), timer = _g[0], setTimer = _g[1];
    var _h = useI18nContext(), LL = _h.LL, locale = _h.locale;
    var formatCurrency = useDisplayCurrency().formatCurrency;
    var description = useDescriptionDisplay({
        tx: tx,
        bankName: galoyInstance.name,
    });
    var onChainTxBroadcasted = ((_b = tx.settlementVia) === null || _b === void 0 ? void 0 : _b.__typename) === "SettlementViaOnChain" &&
        tx.settlementVia.transactionHash !== null;
    var onChainTxNotBroadcasted = ((_c = tx.settlementVia) === null || _c === void 0 ? void 0 : _c.__typename) === "SettlementViaOnChain" &&
        tx.settlementVia.transactionHash === null;
    var arrivalInMempoolEstimatedAt = onChainTxNotBroadcasted &&
        ((_d = tx.settlementVia) === null || _d === void 0 ? void 0 : _d.__typename) === "SettlementViaOnChain" &&
        tx.settlementVia.arrivalInMempoolEstimatedAt;
    var timeDiff = typeof arrivalInMempoolEstimatedAt === "number"
        ? timeToMempool(arrivalInMempoolEstimatedAt)
        : NaN;
    var countdown = typeof arrivalInMempoolEstimatedAt === "number"
        ? formatTimeToMempool(timeDiff, LL, locale)
        : "";
    var _j = useTransactionSeenState(((_f = (_e = homeData === null || homeData === void 0 ? void 0 : homeData.me) === null || _e === void 0 ? void 0 : _e.defaultAccount) === null || _f === void 0 ? void 0 : _f.id) || ""), latestBtcTxId = _j.latestBtcTxId, latestUsdTxId = _j.latestUsdTxId, markTxSeen = _j.markTxSeen;
    React.useEffect(function () {
        var _a, _b;
        var intervalId;
        var onChainTxNotBroadcasted = ((_a = tx === null || tx === void 0 ? void 0 : tx.settlementVia) === null || _a === void 0 ? void 0 : _a.__typename) === "SettlementViaOnChain" &&
            ((_b = tx === null || tx === void 0 ? void 0 : tx.settlementVia) === null || _b === void 0 ? void 0 : _b.transactionHash) === null;
        if (onChainTxNotBroadcasted) {
            intervalId = setInterval(function () {
                if (timer % 30 === 0) {
                    refetch();
                }
                else if (timeDiff <= 0 || Number.isNaN(timeDiff)) {
                    refetch();
                }
                setTimer(function (timer) { return timer + 1; });
            }, 1000);
        }
        return function () {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [tx, refetch, timer, timeDiff]);
    React.useEffect(function () {
        if (!txid || !tx.settlementCurrency)
            return;
        var latestId = tx.settlementCurrency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId;
        if (latestId && latestId === txid) {
            markTxSeen(tx.settlementCurrency);
        }
    }, [txid, tx.settlementCurrency, latestBtcTxId, latestUsdTxId, markTxSeen]);
    // FIXME doesn't work with storybook
    // TODO: translation
    if (!tx || Object.keys(tx).length === 0)
        return <Text>{"No transaction found with this ID (should not happen)"}</Text>;
    var id = tx.id, settlementCurrency = tx.settlementCurrency, settlementAmount = tx.settlementAmount, settlementDisplayFee = tx.settlementDisplayFee, settlementDisplayAmount = tx.settlementDisplayAmount, settlementDisplayCurrency = tx.settlementDisplayCurrency, settlementFee = tx.settlementFee, settlementVia = tx.settlementVia, initiationVia = tx.initiationVia, createdAt = tx.createdAt, status = tx.status;
    if (!settlementCurrency ||
        settlementAmount === undefined ||
        settlementDisplayFee === undefined ||
        settlementDisplayAmount === undefined ||
        !settlementDisplayCurrency ||
        settlementFee === undefined ||
        !settlementVia ||
        !createdAt ||
        !status) {
        return <Text>missing values to render the screen</Text>;
    }
    var isReceive = tx.direction === "RECEIVE";
    var walletCurrency = settlementCurrency;
    var displayAmount = formatCurrency({
        amountInMajorUnits: settlementDisplayAmount,
        currency: settlementDisplayCurrency,
    });
    var formattedPrimaryFeeAmount = formatCurrency({
        amountInMajorUnits: settlementDisplayFee,
        currency: settlementDisplayCurrency,
    });
    var formattedSettlementFee = formatMoneyAmount({
        moneyAmount: toWalletAmount({
            amount: settlementFee,
            currency: settlementCurrency,
        }),
    });
    // only show a secondary amount if it is in a different currency than the primary amount
    var formattedSecondaryFeeAmount = tx.settlementDisplayCurrency === tx.settlementCurrency
        ? undefined
        : formattedSettlementFee;
    var formattedFeeText = formattedPrimaryFeeAmount +
        (formattedSecondaryFeeAmount ? " (".concat(formattedSecondaryFeeAmount, ")") : "");
    var Wallet = (<WalletSummary amountType={isReceive ? "RECEIVE" : "SEND"} settlementAmount={toWalletAmount({
            amount: Math.abs(settlementAmount),
            currency: settlementCurrency,
        })} txDisplayAmount={settlementDisplayAmount} txDisplayCurrency={settlementDisplayCurrency}/>);
    var copyToClipboard = function (_a) {
        var content = _a.content, type = _a.type;
        Clipboard.setString(content);
        toastShow({
            type: "success",
            message: LL.TransactionDetailScreen.hasBeenCopiedToClipboard({ type: type }),
            LL: LL,
        });
    };
    var spendOrReceiveText = "";
    if (isReceive) {
        spendOrReceiveText = LL.TransactionDetailScreen.received();
    }
    else if (onChainTxNotBroadcasted) {
        spendOrReceiveText = LL.TransactionDetailScreen.sending();
    }
    else {
        spendOrReceiveText = LL.TransactionDetailScreen.spent();
    }
    return (<Screen unsafe preset="fixed">
      <View style={[styles.outerContainer, { paddingBottom: insets.bottom }]}>
        <View style={[styles.amountDetailsContainer, { paddingTop: insets.top }]}>
          <View accessible={false} style={styles.closeIconContainer}>
            <GaloyIconButton name="close" onPress={navigation.goBack} iconOnly={true} size={"large"}/>
          </View>
          <View style={styles.amountView}>
            <IconTransaction isReceive={isReceive} walletCurrency={walletCurrency} pending={false} onChain={(settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaOnChain"}/>
            <Text type="h2">{spendOrReceiveText}</Text>
            <Text type="h1">{displayAmount}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.transactionDetailView}>
          {onChainTxNotBroadcasted && (<View style={styles.txNotBroadcast}>
              <GaloyInfo>
                {LL.TransactionDetailScreen.txNotBroadcast({ countdown: countdown })}
              </GaloyInfo>
            </View>)}
          {onChainTxBroadcasted && (<View>
              <Row entry="Transaction Hash" value={("transactionHash" in settlementVia &&
                (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.transactionHash)) ||
                ""} icons={[
                <View key="explorer">
                    <TouchableWithoutFeedback onPress={function () {
                        return viewInExplorer(("transactionHash" in settlementVia &&
                            (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.transactionHash)) ||
                            "");
                    }}>
                      <Icon name="open-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
                <View key="copy">
                    <TouchableWithoutFeedback onPress={function () {
                        return copyToClipboard({
                            content: ("transactionHash" in settlementVia &&
                                (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.transactionHash)) ||
                                "",
                            type: "Transaction Hash",
                        });
                    }}>
                      <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
            ]}/>
            </View>)}
          <Row entry={isReceive
            ? LL.TransactionDetailScreen.receivingAccount()
            : LL.TransactionDetailScreen.sendingAccount()} content={Wallet}/>

          <Row entry={LL.common.date()} value={<TransactionDate createdAt={createdAt} status={status} includeTime={true}/>}/>
          {!isReceive && <Row entry={LL.common.fees()} value={formattedFeeText}/>}
          <Row entry={LL.common.description()} value={description} icons={[
            <View key="copy">
                <TouchableWithoutFeedback onPress={function () {
                    return copyToClipboard({
                        content: description || "",
                        type: LL.common.description(),
                    });
                }}>
                  <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                </TouchableWithoutFeedback>
              </View>,
        ]}/>
          {(settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaIntraLedger" && (<Row entry={LL.TransactionDetailScreen.paid()} value={settlementVia.counterPartyUsername || galoyInstance.name}/>)}
          <Row entry={LL.common.type()} value={typeDisplay(settlementVia)}/>
          {(initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.__typename) === "InitiationViaLn" &&
            (initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentHash) && (<Row entry="Hash" value={initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentHash} icons={[
                <View key="copy">
                    <TouchableWithoutFeedback onPress={function () {
                        var _a;
                        return copyToClipboard({
                            content: (_a = initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentHash) !== null && _a !== void 0 ? _a : "",
                            type: "Hash",
                        });
                    }}>
                      <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
            ]}/>)}

          {((settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaLn" ||
            (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaIntraLedger") &&
            (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.preImage) && (<Row entry={LL.common.preimageProofOfPayment()} value={settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.preImage} icons={[
                <View key="copy">
                    <TouchableWithoutFeedback onPress={function () {
                        return copyToClipboard({
                            content: (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.preImage) || "",
                            type: LL.common.preimageProofOfPayment(),
                        });
                    }}>
                      <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
            ]}/>)}
          {(initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.__typename) === "InitiationViaLn" &&
            (initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentRequest) && (<Row entry={LL.common.paymentRequest()} value={initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentRequest} icons={[
                <View key="explorer">
                    <TouchableWithoutFeedback onPress={function () {
                        return viewInLightningDecoder((initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentRequest) || "");
                    }}>
                      <Icon name="open-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
                <View key="copy">
                    <TouchableWithoutFeedback onPress={function () {
                        var _a;
                        return copyToClipboard({
                            content: (_a = initiationVia === null || initiationVia === void 0 ? void 0 : initiationVia.paymentRequest) !== null && _a !== void 0 ? _a : "",
                            type: LL.common.paymentRequest(),
                        });
                    }}>
                      <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                    </TouchableWithoutFeedback>
                  </View>,
            ]}/>)}
          {id && (<Row entry="Blink Internal Id" value={id} icons={[
                <View key="copy">
                  <TouchableWithoutFeedback onPress={function () {
                        return copyToClipboard({
                            content: id,
                            type: "Blink Internal Id",
                        });
                    }}>
                    <Icon name="copy-outline" size={22} color={colors.primary} style={styles.icon}/>
                  </TouchableWithoutFeedback>
                </View>,
            ]}/>)}
        </ScrollView>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        closeIconContainer: {
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingRight: 10,
        },
        amountText: {
            fontSize: 18,
            marginVertical: 6,
        },
        amountDetailsContainer: {
            backgroundColor: colors.grey5,
        },
        amountView: {
            alignItems: "center",
            justifyContent: "center",
            transform: [{ translateY: -12 }],
        },
        description: {
            marginBottom: 6,
        },
        entry: {
            marginVertical: 4,
        },
        transactionDetailView: {
            marginHorizontal: 24,
            paddingVertical: 12,
        },
        valueContainer: {
            flexDirection: "row",
            minHeight: 60,
            padding: 14,
            backgroundColor: colors.grey5,
            alignItems: "center",
            borderRadius: 8,
        },
        value: {
            flex: 1,
            fontSize: 14,
            fontWeight: "bold",
        },
        valueIcons: {
            flexDirection: "row",
            alignItems: "center",
            marginLeft: 12,
        },
        txNotBroadcast: {
            marginBottom: 16,
        },
        icon: {
            marginBottom: 2,
            marginHorizontal: 6,
        },
        container: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            verticalAlign: "top",
        },
        outerContainer: {
            flex: 1,
        },
    });
});
//# sourceMappingURL=transaction-detail-screen.js.map