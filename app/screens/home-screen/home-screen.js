var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import * as React from "react";
import { useMemo } from "react";
import { RefreshControl, View, Alert, Pressable } from "react-native";
import { gql } from "@apollo/client";
import Modal from "react-native-modal";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation, useIsFocused, useFocusEffect } from "@react-navigation/native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { ScrollView, TouchableWithoutFeedback } from "react-native-gesture-handler";
import { AppUpdate } from "@app/components/app-update/app-update";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { BulletinsCard } from "@app/components/notifications/bulletins";
import { SetDefaultAccountModal } from "@app/components/set-default-account-modal";
import { StableSatsModal } from "@app/components/stablesats-modal";
import WalletOverview from "@app/components/wallet-overview/wallet-overview";
import { BalanceHeader, useTotalBalance } from "@app/components/balance-header";
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal";
import SlideUpHandle from "@app/components/slide-up-handle";
import { Screen } from "@app/components/screen";
import { UnseenTxAmountBadge, useUnseenTxAmountBadge, useOutgoingBadgeVisibility, } from "@app/components/unseen-tx-amount-badge";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getErrorMessages } from "@app/graphql/utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { isIos } from "@app/utils/helper";
import { useAppConfig, useAutoShowUpgradeModal, useTransactionSeenState, } from "@app/hooks";
import { AccountLevel, TxDirection, TxStatus, useBulletinsQuery, useHasPromptedSetDefaultAccountQuery, useHomeAuthedQuery, useHomeUnauthedQuery, useRealtimePriceQuery, useSettingsScreenQuery, } from "@app/graphql/generated";
import { useLevel } from "@app/graphql/level-context";
var TransactionCountToTriggerSetDefaultAccountModal = 1;
var UPGRADE_MODAL_INITIAL_DELAY_MS = 1500;
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query homeAuthed {\n    me {\n      id\n      language\n      username\n      phone\n      email {\n        address\n        verified\n      }\n\n      defaultAccount {\n        id\n        level\n        defaultWalletId\n        pendingIncomingTransactions {\n          ...Transaction\n        }\n        transactions(first: 20) {\n          ...TransactionList\n        }\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n\n  query homeUnauthed {\n    globals {\n      network\n    }\n\n    currencyList {\n      id\n      flag\n      name\n      symbol\n      fractionDigits\n    }\n  }\n\n  query Bulletins($first: Int!, $after: String) {\n    me {\n      id\n      unacknowledgedStatefulNotificationsWithBulletinEnabled(\n        first: $first\n        after: $after\n      ) {\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n        edges {\n          node {\n            id\n            title\n            body\n            createdAt\n            acknowledgedAt\n            bulletinEnabled\n            icon\n            action {\n              ... on OpenDeepLinkAction {\n                deepLink\n              }\n              ... on OpenExternalLinkAction {\n                url\n              }\n            }\n          }\n          cursor\n        }\n      }\n    }\n  }\n"], ["\n  query homeAuthed {\n    me {\n      id\n      language\n      username\n      phone\n      email {\n        address\n        verified\n      }\n\n      defaultAccount {\n        id\n        level\n        defaultWalletId\n        pendingIncomingTransactions {\n          ...Transaction\n        }\n        transactions(first: 20) {\n          ...TransactionList\n        }\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n\n  query homeUnauthed {\n    globals {\n      network\n    }\n\n    currencyList {\n      id\n      flag\n      name\n      symbol\n      fractionDigits\n    }\n  }\n\n  query Bulletins($first: Int!, $after: String) {\n    me {\n      id\n      unacknowledgedStatefulNotificationsWithBulletinEnabled(\n        first: $first\n        after: $after\n      ) {\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n        edges {\n          node {\n            id\n            title\n            body\n            createdAt\n            acknowledgedAt\n            bulletinEnabled\n            icon\n            action {\n              ... on OpenDeepLinkAction {\n                deepLink\n              }\n              ... on OpenExternalLinkAction {\n                url\n              }\n            }\n          }\n          cursor\n        }\n      }\n    }\n  }\n"])));
export var HomeScreen = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var navigation = useNavigation();
    var _o = useRemoteConfig(), balanceLimitToTriggerUpgradeModal = _o.balanceLimitToTriggerUpgradeModal, upgradeModalCooldownDays = _o.upgradeModalCooldownDays;
    var _p = useHasPromptedSetDefaultAccountQuery().data, _q = _p === void 0 ? {} : _p, hasPromptedSetDefaultAccount = _q.hasPromptedSetDefaultAccount;
    var _r = React.useState(false), setDefaultAccountModalVisible = _r[0], setSetDefaultAccountModalVisible = _r[1];
    var reopenUpgradeModal = React.useRef(false);
    var toggleSetDefaultAccountModal = function () {
        return setSetDefaultAccountModalVisible(!setDefaultAccountModalVisible);
    };
    var isAtLeastLevelOne = useLevel().isAtLeastLevelOne;
    var isAuthed = useIsAuthed();
    var LL = useI18nContext().LL;
    var galoyInstanceId = useAppConfig().appConfig.galoyInstance.id;
    var isFocused = useIsFocused();
    var _s = useHomeAuthedQuery({
        skip: !isAuthed,
        fetchPolicy: "network-only",
        errorPolicy: "all",
        // this enables offline mode use-case
        nextFetchPolicy: "cache-and-network",
    }), dataAuthed = _s.data, loadingAuthed = _s.loading, error = _s.error, refetchAuthed = _s.refetch;
    var _t = useRealtimePriceQuery({
        skip: !isAuthed,
        fetchPolicy: "network-only",
        // this enables offline mode use-case
        nextFetchPolicy: "cache-and-network",
    }), loadingPrice = _t.loading, refetchRealtimePrice = _t.refetch;
    var _u = useHomeUnauthedQuery({
        skip: !isAuthed,
        fetchPolicy: "network-only",
        // this enables offline mode use-case
        nextFetchPolicy: "cache-and-network",
    }), refetchUnauthed = _u.refetch, loadingUnauthed = _u.loading, dataUnauthed = _u.data;
    // keep settings info cached and ignore network call if it's already cached
    var _v = useSettingsScreenQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-first",
        // this enables offline mode use-case
        nextFetchPolicy: "cache-and-network",
    }), currentUser = _v.data, loadingSettings = _v.loading;
    // load bulletins on home screen
    var _w = useBulletinsQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-and-network",
        variables: { first: 1 },
    }), bulletins = _w.data, bulletinsLoading = _w.loading, refetchBulletins = _w.refetch;
    var loading = loadingAuthed || loadingPrice || loadingUnauthed || loadingSettings;
    var _x = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.me) !== null && _a !== void 0 ? _a : {}, username = _x.username, phone = _x.phone;
    var usernameTitle = username || phone || LL.common.blinkUser();
    var wallets = (_c = (_b = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets;
    var _y = useTotalBalance(wallets), formattedBalance = _y.formattedBalance, satsBalance = _y.satsBalance;
    var accountId = (_e = (_d = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.id;
    var levelAccount = (_f = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _f === void 0 ? void 0 : _f.defaultAccount.level;
    var pendingIncomingTransactions = (_h = (_g = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _g === void 0 ? void 0 : _g.defaultAccount) === null || _h === void 0 ? void 0 : _h.pendingIncomingTransactions;
    var transactionsEdges = (_l = (_k = (_j = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _j === void 0 ? void 0 : _j.defaultAccount) === null || _k === void 0 ? void 0 : _k.transactions) === null || _l === void 0 ? void 0 : _l.edges;
    var transactions = useMemo(function () {
        var _a;
        var txs = [];
        if (pendingIncomingTransactions)
            txs.push.apply(txs, pendingIncomingTransactions);
        var settled = (_a = transactionsEdges === null || transactionsEdges === void 0 ? void 0 : transactionsEdges.map(function (e) { return e.node; }).filter(function (tx) { return tx.status !== TxStatus.Pending || tx.direction === TxDirection.Send; })) !== null && _a !== void 0 ? _a : [];
        txs.push.apply(txs, settled);
        return txs;
    }, [pendingIncomingTransactions, transactionsEdges]);
    var _z = useTransactionSeenState(accountId || "", transactions), hasUnseenBtcTx = _z.hasUnseenBtcTx, hasUnseenUsdTx = _z.hasUnseenUsdTx, markTxSeen = _z.markTxSeen;
    var _0 = useAutoShowUpgradeModal({
        cooldownDays: upgradeModalCooldownDays,
        enabled: isAuthed && levelAccount === AccountLevel.Zero,
    }), canShowUpgradeModal = _0.canShowUpgradeModal, markShownUpgradeModal = _0.markShownUpgradeModal;
    var _1 = useUnseenTxAmountBadge({
        transactions: transactions,
        hasUnseenBtcTx: hasUnseenBtcTx,
        hasUnseenUsdTx: hasUnseenUsdTx,
    }), latestUnseenTx = _1.latestUnseenTx, unseenAmountText = _1.unseenAmountText, handleUnseenBadgePress = _1.handleUnseenBadgePress, isOutgoing = _1.isOutgoing;
    var handleOutgoingBadgeHide = React.useCallback(function () {
        if (latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.settlementCurrency) {
            markTxSeen(latestUnseenTx.settlementCurrency);
        }
    }, [latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.settlementCurrency, markTxSeen]);
    var showOutgoingBadge = useOutgoingBadgeVisibility({
        txId: latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.id,
        amountText: unseenAmountText,
        isOutgoing: isOutgoing,
        onHide: handleOutgoingBadgeHide,
    });
    var _2 = React.useState(false), modalVisible = _2[0], setModalVisible = _2[1];
    var _3 = React.useState(false), isStablesatModalVisible = _3[0], setIsStablesatModalVisible = _3[1];
    var _4 = React.useState(false), isUpgradeModalVisible = _4[0], setIsUpgradeModalVisible = _4[1];
    var closeUpgradeModal = function () { return setIsUpgradeModalVisible(false); };
    var openUpgradeModal = React.useCallback(function () {
        setIsUpgradeModalVisible(true);
    }, []);
    var triggerUpgradeModal = React.useCallback(function () {
        if (!accountId || levelAccount !== AccountLevel.Zero)
            return;
        if (!canShowUpgradeModal || satsBalance <= balanceLimitToTriggerUpgradeModal)
            return;
        openUpgradeModal();
        markShownUpgradeModal();
    }, [
        accountId,
        levelAccount,
        canShowUpgradeModal,
        satsBalance,
        balanceLimitToTriggerUpgradeModal,
        markShownUpgradeModal,
        openUpgradeModal,
    ]);
    var refetch = React.useCallback(function () {
        if (!isAuthed)
            return;
        Promise.all([
            refetchRealtimePrice(),
            refetchAuthed(),
            refetchUnauthed(),
            refetchBulletins(),
        ]).then(function () {
            // Triggers the upgrade trial account modal after refetch
            triggerUpgradeModal();
        });
    }, [
        isAuthed,
        refetchAuthed,
        refetchBulletins,
        refetchRealtimePrice,
        refetchUnauthed,
        triggerUpgradeModal,
    ]);
    var numberOfTxs = transactions.length;
    var onMenuClick = function (target) {
        if (isAuthed) {
            if (target === "receiveBitcoin" &&
                !hasPromptedSetDefaultAccount &&
                numberOfTxs >= TransactionCountToTriggerSetDefaultAccountModal &&
                galoyInstanceId === "Main") {
                toggleSetDefaultAccountModal();
                return;
            }
            // we are using any because Typescript complain on the fact we are not passing any params
            // but there is no need for a params and the types should not necessitate it
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            navigation.navigate(target);
        }
        else {
            setModalVisible(true);
        }
    };
    var activateWallet = function () {
        setModalVisible(false);
        navigation.navigate("acceptTermsAndConditions", { flow: "phone" });
    };
    // debug code. verify that we have 2 wallets. mobile doesn't work well with only one wallet
    // TODO: add this code in a better place
    React.useEffect(function () {
        if ((wallets === null || wallets === void 0 ? void 0 : wallets.length) !== undefined && (wallets === null || wallets === void 0 ? void 0 : wallets.length) !== 2) {
            Alert.alert(LL.HomeScreen.walletCountNotTwo());
        }
    }, [wallets, LL]);
    // Trigger the upgrade trial account modal
    useFocusEffect(React.useCallback(function () {
        if (reopenUpgradeModal.current) {
            openUpgradeModal();
            reopenUpgradeModal.current = false;
            return;
        }
        var id = setTimeout(function () {
            triggerUpgradeModal();
        }, UPGRADE_MODAL_INITIAL_DELAY_MS);
        return function () { return clearTimeout(id); };
    }, [openUpgradeModal, triggerUpgradeModal]));
    var buttons = [
        {
            title: LL.HomeScreen.receive(),
            target: "receiveBitcoin",
            icon: "receive",
        },
        {
            title: LL.HomeScreen.send(),
            target: "sendBitcoinDestination",
            icon: "send",
        },
        {
            title: LL.HomeScreen.scan(),
            target: "scanningQRCode",
            icon: "qr-code",
        },
    ];
    var isIosWithBalance = isIos && satsBalance > 0;
    if (!isIos ||
        ((_m = dataUnauthed === null || dataUnauthed === void 0 ? void 0 : dataUnauthed.globals) === null || _m === void 0 ? void 0 : _m.network) !== "mainnet" ||
        levelAccount === AccountLevel.Two ||
        levelAccount === AccountLevel.Three ||
        isIosWithBalance) {
        buttons.unshift({
            title: LL.ConversionDetailsScreen.transfer(),
            target: "conversionDetails",
            icon: "transfer",
        });
    }
    var AccountCreationNeededModal = (<Modal style={styles.modal} isVisible={modalVisible} swipeDirection={modalVisible ? ["down"] : ["up"]} onSwipeComplete={function () { return setModalVisible(false); }} animationOutTiming={1} swipeThreshold={50}>
      <View style={styles.flex}>
        <TouchableWithoutFeedback onPress={function () { return setModalVisible(false); }}>
          <View style={styles.cover}/>
        </TouchableWithoutFeedback>
      </View>
      <View style={styles.viewModal}>
        <Icon name="remove" size={64} color={colors.grey3} style={styles.icon}/>
        <Text type="h1">{LL.common.needWallet()}</Text>
        <View style={styles.openWalletContainer}>
          <GaloyPrimaryButton title={LL.GetStartedScreen.logInCreateAccount()} onPress={activateWallet}/>
        </View>
        <View style={styles.flex}/>
      </View>
    </Modal>);
    var handleSwitchPress = function () {
        navigation.navigate("profileScreen");
    };
    return (<Screen headerShown={false}>
      {AccountCreationNeededModal}
      <StableSatsModal isVisible={isStablesatModalVisible} setIsVisible={setIsStablesatModalVisible}/>
      <TrialAccountLimitsModal isVisible={isUpgradeModalVisible} closeModal={closeUpgradeModal} beforeSubmit={function () {
            reopenUpgradeModal.current = true;
        }}/>
      <View style={styles.balanceContainer}>
        <View style={styles.header}>
          <GaloyIconButton onPress={function () { return navigation.navigate("priceHistory"); }} size={"medium"} name="graph" iconOnly={true}/>
          <View>
            {!loading && usernameTitle && (<Pressable onPress={isAtLeastLevelOne ? handleSwitchPress : null}>
                <View style={styles.profileContainer}>
                  <Text type="p2">{usernameTitle}</Text>
                  {isAtLeastLevelOne && <GaloyIcon name={"caret-down"} size={18}/>}
                </View>
              </Pressable>)}
          </View>
          <GaloyIconButton onPress={function () { return navigation.navigate("settings"); }} size={"medium"} name="menu" iconOnly={true}/>
        </View>
      </View>
      <BalanceHeader loading={loading} formattedBalance={formattedBalance}/>
      <View style={styles.badgeSlot}>
        <UnseenTxAmountBadge key={latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.id} amountText={unseenAmountText !== null && unseenAmountText !== void 0 ? unseenAmountText : ""} visible={isOutgoing ? showOutgoingBadge : Boolean(unseenAmountText)} onPress={handleUnseenBadgePress} isOutgoing={isOutgoing}/>
      </View>
      <ScrollView {...testProps("home-screen")} contentContainerStyle={styles.scrollViewContainer} refreshControl={<RefreshControl refreshing={loading && isFocused} onRefresh={refetch} colors={[colors.primary]} tintColor={colors.primary}/>}>
        <WalletOverview loading={loading} setIsStablesatModalVisible={setIsStablesatModalVisible} wallets={wallets} showBtcNotification={isOutgoing ? false : hasUnseenBtcTx} showUsdNotification={isOutgoing ? false : hasUnseenUsdTx}/>
        {error && <GaloyErrorBox errorMessage={getErrorMessages(error)}/>}
        <View style={styles.listItemsContainer}>
          {buttons.map(function (item) { return (<React.Fragment key={item.icon}>
              {item.icon === "qr-code" && <View style={styles.actionsSeparator}/>}
              <View style={styles.button}>
                <GaloyIconButton name={item.icon} size="large" text={item.title} onPress={function () { return onMenuClick(item.target); }}/>
              </View>
            </React.Fragment>); })}
        </View>
        <BulletinsCard loading={bulletinsLoading} bulletins={bulletins}/>
        <AppUpdate />
        <SetDefaultAccountModal isVisible={setDefaultAccountModalVisible} toggleModal={function () {
            toggleSetDefaultAccountModal();
            navigation.navigate("receiveBitcoin");
        }}/>
      </ScrollView>
      <SlideUpHandle bottomOffset={15} onAction={function () { return navigation.navigate("transactionHistory"); }}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        scrollViewContainer: {
            paddingHorizontal: 20,
            paddingBottom: 20,
            rowGap: 20,
        },
        listItemsContainer: {
            paddingHorizontal: 15,
            paddingVertical: 15,
            borderRadius: 12,
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            columnGap: 12,
        },
        noTransaction: {
            alignItems: "center",
        },
        icon: {
            height: 34,
            top: -22,
        },
        modal: {
            marginBottom: 0,
            marginHorizontal: 0,
        },
        flex: {
            flex: 1,
        },
        cover: {
            height: "100%",
            width: "100%",
        },
        viewModal: {
            alignItems: "center",
            backgroundColor: colors.white,
            height: "30%",
            justifyContent: "flex-end",
            paddingHorizontal: 20,
        },
        openWalletContainer: {
            alignSelf: "stretch",
            marginTop: 20,
        },
        recentTransaction: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            columnGap: 10,
            backgroundColor: colors.grey5,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderColor: colors.grey5,
            borderBottomWidth: 2,
            paddingVertical: 14,
        },
        button: {
            maxWidth: "25%",
            flexGrow: 1,
            alignItems: "center",
        },
        balanceContainer: {
            marginTop: 7,
            flexDirection: "column",
            flex: 1,
            height: 40,
            maxHeight: 40,
        },
        header: {
            flexDirection: "row",
            flex: 1,
            justifyContent: "space-between",
            alignItems: "center",
            marginHorizontal: 20,
            marginTop: 6,
        },
        error: {
            alignSelf: "center",
            color: colors.error,
        },
        profileContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        actionsSeparator: {
            width: 1,
            alignSelf: "stretch",
            backgroundColor: colors.grey4,
        },
        badgeSlot: {
            height: 35,
            marginVertical: 3,
            justifyContent: "center",
            alignItems: "center",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=home-screen.js.map