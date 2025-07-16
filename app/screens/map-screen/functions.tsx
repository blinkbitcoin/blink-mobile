import { Region } from "react-native-maps"
import { PERMISSIONS } from "react-native-permissions"

import { isIos } from "@app/utils/helper"
import Geolocation, { GeolocationResponse } from "@react-native-community/geolocation"

export const LOCATION_PERMISSION = isIos
  ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
  : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION

export const getUserRegion = (callback: (region?: Region) => void) => {
  try {
    Geolocation.getCurrentPosition(
      (position: GeolocationResponse) => {
        if (position) {
          const region: Region = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
          callback(region)
        }
      },
      () => {
        callback(undefined)
      },
      { timeout: 5000 },
    )
  } catch (e) {
    callback(undefined)
  }
}
