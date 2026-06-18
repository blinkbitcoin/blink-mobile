import React, { useEffect, useMemo, useRef } from "react"
import { gql, useApolloClient } from "@apollo/client"
import { Screen } from "@app/components/screen"
import {
  StatefulNotificationsDocument,
  UnacknowledgedNotificationCountDocument,
  useStatefulNotificationAcknowledgeMutation,
  useStatefulNotificationsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { useIsFocused } from "@react-navigation/native"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { FlatList, RefreshControl } from "react-native-gesture-handler"
import { Notification } from "./notification"

gql`
  mutation StatefulNotificationAcknowledge(
    $input: StatefulNotificationAcknowledgeInput!
  ) {
    statefulNotificationAcknowledge(input: $input) {
      notification {
        acknowledgedAt
      }
    }
  }

  query StatefulNotifications($after: String) {
    me {
      statefulNotificationsWithoutBulletinEnabled(first: 20, after: $after) {
        nodes {
          id
          title
          body
          createdAt
          acknowledgedAt
          bulletinEnabled
          icon
          action {
            ... on OpenDeepLinkAction {
              deepLink
              label
            }
            ... on OpenExternalLinkAction {
              url
              label
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
      }
    }
  }
`

export const NotificationHistoryScreen = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const isFocused = useIsFocused()
  const client = useApolloClient()
  const acknowledgedIdsRef = useRef(new Set<string>())
  const inFlightIdsRef = useRef(new Set<string>())
  const lastUnackIdsKeyRef = useRef("")

  const { LL } = useI18nContext()

  const { data, fetchMore, refetch, loading } = useStatefulNotificationsQuery({
    skip: !useIsAuthed(),
  })
  const [acknowledgeNotification] = useStatefulNotificationAcknowledgeMutation()
  const notifications = data?.me?.statefulNotificationsWithoutBulletinEnabled

  const unackIdsKey = useMemo(() => {
    const nodes = notifications?.nodes
    if (!nodes?.length) return ""
    return nodes
      .filter((notification) => !notification.acknowledgedAt)
      .map((notification) => notification.id)
      .join("|")
  }, [notifications?.nodes])

  useEffect(() => {
    if (!isFocused || !notifications?.nodes?.length) return
    if (!unackIdsKey || unackIdsKey === lastUnackIdsKeyRef.current) return
    lastUnackIdsKeyRef.current = unackIdsKey

    const unacknowledged = notifications.nodes.filter(
      (notification) =>
        !notification.acknowledgedAt &&
        !acknowledgedIdsRef.current.has(notification.id) &&
        !inFlightIdsRef.current.has(notification.id),
    )

    if (unacknowledged.length === 0) return

    // Guard against post-unmount work: without it, the promise chain below keeps
    // running after the screen unmounts, firing Apollo refetches into a torn-down
    // tree (a source of flaky test timeouts and act() warnings).
    let cancelled = false

    unacknowledged.forEach((notification) => {
      inFlightIdsRef.current.add(notification.id)
    })

    Promise.all(
      unacknowledged.map((notification) =>
        acknowledgeNotification({
          variables: { input: { notificationId: notification.id } },
        })
          .then(() => {
            if (cancelled) return
            acknowledgedIdsRef.current.add(notification.id)
          })
          .finally(() => {
            inFlightIdsRef.current.delete(notification.id)
          }),
      ),
    )
      .then(() => {
        if (cancelled) return
        client.refetchQueries({
          include: [
            UnacknowledgedNotificationCountDocument,
            StatefulNotificationsDocument,
          ],
        })
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
      })

    return () => {
      cancelled = true
    }
  }, [acknowledgeNotification, client, isFocused, unackIdsKey])

  const fetchNextNotificationsPage = () => {
    const pageInfo = notifications?.pageInfo

    if (pageInfo?.hasNextPage) {
      fetchMore({
        variables: {
          after: pageInfo.endCursor,
        },
      })
    }
  }

  return (
    <Screen>
      <FlatList
        {...testProps("notification-screen")}
        contentContainerStyle={styles.scrollViewContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading && isFocused}
            onRefresh={refetch}
            colors={[colors.primary]} // Android refresh indicator colors
            tintColor={colors.primary} // iOS refresh indicator color
          />
        }
        data={notifications?.nodes.filter((n) => !n.bulletinEnabled)}
        renderItem={({ item }) => <Notification {...item} />}
        onEndReached={fetchNextNotificationsPage}
        onEndReachedThreshold={0.5}
        onRefresh={refetch}
        refreshing={loading}
        ListEmptyComponent={
          loading ? (
            <></>
          ) : (
            <Text style={styles.center}>{LL.NotificationHistory.noNotifications()}</Text>
          )
        }
      ></FlatList>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  scrollViewContainer: {},
  center: {
    textAlign: "center",
    marginTop: 10,
  },
}))
