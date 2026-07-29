// eslint-disable-next-line react-native/split-platform-components
import { Platform, PermissionsAndroid } from "react-native"

import { ApolloClient, gql } from "@apollo/client"
import { DeviceNotificationTokenCreateDocument } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"
import messaging from "@react-native-firebase/messaging"

// No op if the permission has already been requested
export const requestNotificationPermission = () => messaging().requestPermission()

gql`
  mutation deviceNotificationTokenCreate($input: DeviceNotificationTokenCreateInput!) {
    deviceNotificationTokenCreate(input: $input) {
      errors {
        message
      }
      success
    }
  }
`

// This is a global variable to avoid adding the device token multiple times at the same time
let addingDeviceToken = false
export const addDeviceToken = async (client: ApolloClient<unknown>): Promise<void> => {
  if (addingDeviceToken) {
    return
  }
  addingDeviceToken = true
  try {
    const deviceToken = await messaging().getToken()
    await client.mutate({
      mutation: DeviceNotificationTokenCreateDocument,
      variables: { input: { deviceToken } },
    })
  } catch (err: unknown) {
    reportError("device-token-registration", err, {
      dedupKey: "device-token-registration",
    })
    console.error(err, "impossible to upload device token")
  }
  if (addingDeviceToken) {
    addingDeviceToken = false
  }
}

export const hasNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === "ios") {
    const authorizationStatus = await messaging().hasPermission()
    return (
      authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL
    )
  }

  if (Platform.OS === "android") {
    const authorizationStatusAndroid = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    )
    return authorizationStatusAndroid === PermissionsAndroid.RESULTS.GRANTED || false
  }

  return false
}
