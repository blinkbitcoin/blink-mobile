import { useEffect } from "react"

import { useApolloClient } from "@apollo/client"
import messaging from "@react-native-firebase/messaging"
import { useIsFocused } from "@react-navigation/native"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { addDeviceToken, requestNotificationPermission } from "@app/utils/notifications"

const WAIT_TIME_TO_PROMPT_USER = 5000

export const useNotificationPermission = () => {
  const isAuthed = useIsAuthed()
  const isFocused = useIsFocused()
  const client = useApolloClient()

  useEffect(() => {
    if (!isAuthed || !isFocused || !client) return

    const timeout = setTimeout(async () => {
      const result = await requestNotificationPermission()
      if (
        result === messaging.AuthorizationStatus.PROVISIONAL ||
        result === messaging.AuthorizationStatus.AUTHORIZED
      ) {
        await addDeviceToken(client)
      }
    }, WAIT_TIME_TO_PROMPT_USER)

    return () => clearTimeout(timeout)
  }, [isAuthed, isFocused, client])
}
