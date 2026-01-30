var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import React, { useEffect, useMemo, useRef } from "react";
import { gql, useApolloClient } from "@apollo/client";
import { Screen } from "@app/components/screen";
import { StatefulNotificationsDocument, UnacknowledgedNotificationCountDocument, useStatefulNotificationAcknowledgeMutation, useStatefulNotificationsQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { useIsFocused } from "@react-navigation/native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { FlatList, RefreshControl } from "react-native-gesture-handler";
import { Notification } from "./notification";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation StatefulNotificationAcknowledge(\n    $input: StatefulNotificationAcknowledgeInput!\n  ) {\n    statefulNotificationAcknowledge(input: $input) {\n      notification {\n        acknowledgedAt\n      }\n    }\n  }\n\n  query StatefulNotifications($after: String) {\n    me {\n      statefulNotificationsWithoutBulletinEnabled(first: 20, after: $after) {\n        nodes {\n          id\n          title\n          body\n          createdAt\n          acknowledgedAt\n          bulletinEnabled\n          icon\n          action {\n            ... on OpenDeepLinkAction {\n              deepLink\n            }\n            ... on OpenExternalLinkAction {\n              url\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n"], ["\n  mutation StatefulNotificationAcknowledge(\n    $input: StatefulNotificationAcknowledgeInput!\n  ) {\n    statefulNotificationAcknowledge(input: $input) {\n      notification {\n        acknowledgedAt\n      }\n    }\n  }\n\n  query StatefulNotifications($after: String) {\n    me {\n      statefulNotificationsWithoutBulletinEnabled(first: 20, after: $after) {\n        nodes {\n          id\n          title\n          body\n          createdAt\n          acknowledgedAt\n          bulletinEnabled\n          icon\n          action {\n            ... on OpenDeepLinkAction {\n              deepLink\n            }\n            ... on OpenExternalLinkAction {\n              url\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n"])));
export var NotificationHistoryScreen = function () {
    var _a;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var isFocused = useIsFocused();
    var client = useApolloClient();
    var acknowledgedIdsRef = useRef(new Set());
    var inFlightIdsRef = useRef(new Set());
    var lastUnackIdsKeyRef = useRef("");
    var LL = useI18nContext().LL;
    var _b = useStatefulNotificationsQuery({
        skip: !useIsAuthed(),
    }), data = _b.data, fetchMore = _b.fetchMore, refetch = _b.refetch, loading = _b.loading;
    var acknowledgeNotification = useStatefulNotificationAcknowledgeMutation()[0];
    var notifications = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.statefulNotificationsWithoutBulletinEnabled;
    var unackIdsKey = useMemo(function () {
        var nodes = notifications === null || notifications === void 0 ? void 0 : notifications.nodes;
        if (!(nodes === null || nodes === void 0 ? void 0 : nodes.length))
            return "";
        return nodes
            .filter(function (notification) { return !notification.acknowledgedAt; })
            .map(function (notification) { return notification.id; })
            .join("|");
    }, [notifications === null || notifications === void 0 ? void 0 : notifications.nodes]);
    useEffect(function () {
        var _a;
        if (!isFocused || !((_a = notifications === null || notifications === void 0 ? void 0 : notifications.nodes) === null || _a === void 0 ? void 0 : _a.length))
            return;
        if (!unackIdsKey || unackIdsKey === lastUnackIdsKeyRef.current)
            return;
        lastUnackIdsKeyRef.current = unackIdsKey;
        var unacknowledged = notifications.nodes.filter(function (notification) {
            return !notification.acknowledgedAt &&
                !acknowledgedIdsRef.current.has(notification.id) &&
                !inFlightIdsRef.current.has(notification.id);
        });
        if (unacknowledged.length === 0)
            return;
        unacknowledged.forEach(function (notification) {
            inFlightIdsRef.current.add(notification.id);
        });
        Promise.all(unacknowledged.map(function (notification) {
            return acknowledgeNotification({
                variables: { input: { notificationId: notification.id } },
            })
                .then(function () {
                acknowledgedIdsRef.current.add(notification.id);
            })
                .finally(function () {
                inFlightIdsRef.current.delete(notification.id);
            });
        }))
            .then(function () {
            client.refetchQueries({
                include: [
                    UnacknowledgedNotificationCountDocument,
                    StatefulNotificationsDocument,
                ],
            });
        })
            .catch(console.error);
    }, [acknowledgeNotification, client, isFocused, unackIdsKey]);
    var fetchNextNotificationsPage = function () {
        var pageInfo = notifications === null || notifications === void 0 ? void 0 : notifications.pageInfo;
        if (pageInfo === null || pageInfo === void 0 ? void 0 : pageInfo.hasNextPage) {
            fetchMore({
                variables: {
                    after: pageInfo.endCursor,
                },
            });
        }
    };
    return (<Screen>
      <FlatList {...testProps("notification-screen")} contentContainerStyle={styles.scrollViewContainer} refreshControl={<RefreshControl refreshing={loading && isFocused} onRefresh={refetch} colors={[colors.primary]} // Android refresh indicator colors
         tintColor={colors.primary} // iOS refresh indicator color
        />} data={notifications === null || notifications === void 0 ? void 0 : notifications.nodes.filter(function (n) { return !n.bulletinEnabled; })} renderItem={function (_a) {
        var item = _a.item;
        return <Notification {...item}/>;
    }} onEndReached={fetchNextNotificationsPage} onEndReachedThreshold={0.5} onRefresh={refetch} refreshing={loading} ListEmptyComponent={loading ? (<></>) : (<Text style={styles.center}>{LL.NotificationHistory.noNotifications()}</Text>)}></FlatList>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    scrollViewContainer: {},
    center: {
        textAlign: "center",
        marginTop: 10,
    },
}); });
var templateObject_1;
//# sourceMappingURL=notification-history-screen.js.map