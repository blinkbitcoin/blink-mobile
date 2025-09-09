import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import { useStatefulNotificationsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { useIsFocused } from "@react-navigation/native"
import { Text, makeStyles, useTheme } from "@rneui/themed"
import { FlatList, RefreshControl } from "react-native-gesture-handler"
import { Notification } from "./notification"

gql`
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
            }
            ... on OpenExternalLinkAction {
              url
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

  const { LL } = useI18nContext()

  const { data, fetchMore, refetch, loading } = useStatefulNotificationsQuery({
    skip: !useIsAuthed(),
  })
  const notifications = data?.me?.statefulNotificationsWithoutBulletinEnabled

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
