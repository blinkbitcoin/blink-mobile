import React, { useEffect } from "react"

import { useApolloClient } from "@apollo/client"
import { BulletinsDocument } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { addDeviceToken, hasNotificationPermission } from "@app/utils/notifications"
import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging"
import { Linking } from "react-native"

export const PushNotificationComponent = (): JSX.Element => {
  const client = useApolloClient()
  const isAuthed = useIsAuthed()

  useEffect(() => {
    const followNotificationLink = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage,
    ) => {
      try {
        const linkToScreen = remoteMessage.data?.linkTo ?? ""
        if (
          typeof linkToScreen === "string" &&
          linkToScreen &&
          linkToScreen.startsWith("/")
        ) {
          Linking.openURL("blink:" + linkToScreen)
        }
        // linkTo throws an error if the link is invalid
      } catch (error) {
        console.error("Error in showNotification", error)
      }
    }

    // When the application is running, but in the background.
    const unsubscribeBackground = messaging().onNotificationOpenedApp(
      (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        followNotificationLink(remoteMessage)
      },
    )

    const unsubscribeInApp = messaging().onMessage(async (remoteMessage) => {
      console.log("A new FCM message arrived!", remoteMessage)
      client.refetchQueries({ include: [BulletinsDocument] })
    })

    // When the application is opened from a quit state.
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          followNotificationLink(remoteMessage)
        }
      })

    return () => {
      unsubscribeInApp()
      unsubscribeBackground()
    }
  }, [client])

  useEffect(() => {
    ;(async () => {
      if (isAuthed && client) {
        const hasPermission = await hasNotificationPermission()
        if (hasPermission) {
          addDeviceToken(client)
          const unsubscribeFromRefresh = messaging().onTokenRefresh(() =>
            addDeviceToken(client),
          )
          return unsubscribeFromRefresh
        }
      }
    })()
  }, [client, isAuthed])

  return <></>
}
