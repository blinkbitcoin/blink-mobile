import { useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { useCallback } from "react"
// eslint-disable-next-line react-native/split-platform-components
import { ActivityIndicator, View } from "react-native"
import Geolocation from "@react-native-community/geolocation"
import MapView, {
  Callout,
  CalloutSubview,
  MapMarkerProps,
  Marker,
  Region,
} from "react-native-maps"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { isIos } from "../../utils/helper"
import { toastShow } from "../../utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useBusinessMapMarkersQuery } from "@app/graphql/generated"
import { gql } from "@apollo/client"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { Text, makeStyles, useTheme } from "@rneui/themed"
import { PhoneLoginInitiateType } from "../phone-auth-screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import MapStyles from "./map-styles.json"

const EL_ZONTE_COORDS = {
  latitude: 13.496743,
  longitude: -89.439462,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "Primary">
}

type GeolocationPermissionNegativeError = {
  code: number
  message: string
  PERMISSION_DENIED: number
  POSITION_UNAVAILABLE: number
  TIMEOUT: number
}

gql`
  query businessMapMarkers {
    businessMapMarkers {
      username
      mapInfo {
        title
        coordinates {
          longitude
          latitude
        }
      }
    }
  }
`

export const MapScreen: React.FC<Props> = ({ navigation }) => {
  const {
    theme: { colors, mode: themeMode },
  } = useTheme()
  const styles = useStyles()
  const isAuthed = useIsAuthed()

  const [isLoadingLocation, setIsLoadingLocation] = React.useState(true)
  const [userLocation, setUserLocation] = React.useState<Region>()
  const [isRefreshed, setIsRefreshed] = React.useState(false)
  const { data, error, refetch } = useBusinessMapMarkersQuery({
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  })
  const { LL } = useI18nContext()

  useFocusEffect(() => {
    if (!isRefreshed) {
      setIsRefreshed(true)
      refetch()
    }
  })

  if (error) {
    toastShow({ message: error.message, LL })
  }

  const maps = data?.businessMapMarkers ?? []

  const getUserRegion = (callback: (region?: Region) => void) => {
    try {
      Geolocation.getCurrentPosition(
        (data: GeolocationPosition) => {
          if (data) {
            const region: Region = {
              latitude: data.coords.latitude,
              longitude: data.coords.longitude,
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

  const requestLocationPermission = useCallback(() => {
    const permittedResponse = () => {
      getUserRegion((region) => {
        if (region) {
          setUserLocation(region)
        }
        setIsLoadingLocation(false)
      })
    }

    const negativeResponse = (error: GeolocationPermissionNegativeError) => {
      console.debug("Permission location denied: ", error)
    }

    Geolocation.requestAuthorization(permittedResponse, negativeResponse)
  }, [])

  useFocusEffect(requestLocationPermission)

  // TODO this should be memoized for performance improvements. Use reduce() inside a useMemo() with some dependency array values
  const markers: ReturnType<React.FC<MapMarkerProps>>[] = []
  maps.forEach((item) => {
    if (item) {
      const onPress = () => {
        if (isAuthed && item?.username) {
          navigation.navigate("sendBitcoinDestination", { username: item.username })
        } else {
          navigation.navigate("phoneFlow", {
            screen: "phoneLoginInitiate",
            params: {
              type: PhoneLoginInitiateType.CreateAccount,
            },
          })
        }
      }

      markers.push(
        <Marker
          coordinate={item.mapInfo.coordinates}
          key={item.username}
          pinColor={colors._orange}
        >
          <Callout onPress={() => (Boolean(item.username) && !isIos ? onPress() : null)}>
            <View style={styles.customView}>
              <Text type="h1" style={styles.title}>
                {item.mapInfo.title}
              </Text>
              {Boolean(item.username) &&
                (isIos ? (
                  <CalloutSubview onPress={() => onPress()}>
                    <GaloyPrimaryButton
                      style={styles.ios}
                      title={LL.MapScreen.payBusiness()}
                    />
                  </CalloutSubview>
                ) : (
                  <GaloyPrimaryButton
                    containerStyle={styles.android}
                    title={LL.MapScreen.payBusiness()}
                  />
                ))}
            </View>
          </Callout>
        </Marker>,
      )
    }
  })

  return (
    <Screen>
      {isLoadingLocation ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <MapView
          style={styles.map}
          showsUserLocation={true}
          initialRegion={userLocation ?? EL_ZONTE_COORDS}
          customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light}
        >
          {markers}
        </MapView>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  android: { marginTop: 18 },

  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  customView: {
    alignItems: "center",
    margin: 12,
  },

  ios: { paddingTop: 12 },

  map: {
    height: "100%",
    width: "100%",
  },

  title: { color: colors._darkGrey },
}))
