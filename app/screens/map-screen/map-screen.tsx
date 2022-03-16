import { gql, useQuery } from "@apollo/client"
import { useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { useCallback } from "react"
// eslint-disable-next-line react-native/split-platform-components
import { PermissionsAndroid, StyleSheet, Text, View } from "react-native"
import { Button } from "react-native-elements"
import MapView, { Callout, CalloutSubview, Marker } from "react-native-maps"
import { Screen } from "../../components/screen"
import { PrimaryStackParamList } from "../../navigation/stack-param-lists"
import { ScreenType } from "../../types/jsx"
import { isIos } from "../../utils/helper"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import { toastShow } from "../../utils/toast"
import useToken from "../../utils/use-token"

const QUERY_BUSINESSES = gql`
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

const styles = StyleSheet.create({
  android: { marginTop: 18 },

  customView: {
    alignItems: "center",
    margin: 12,
  },

  ios: { paddingTop: 12 },

  map: {
    height: "100%",
    width: "100%",
  },

  title: { color: palette.darkGrey, fontSize: 18 },
})

type Props = {
  navigation: StackNavigationProp<PrimaryStackParamList, "Map">
}

export const MapScreen: ScreenType = ({ navigation }: Props) => {
  const { hasToken } = useToken()
  const [isRefreshed, setIsRefreshed] = React.useState(false)
  const [otherPinData, setOtherPinData] = React.useState([])
  const { data, error, refetch } = useQuery(QUERY_BUSINESSES, {
    notifyOnNetworkStatusChange: true,
  })

  const fetchOtherPins = async () => {
    try {
      const res = await fetch('https://us-central1-bitcoin-jungle-maps.cloudfunctions.net/location-list')
      const data = await res.json()

      if(res.ok) {
        setOtherPinData(
          data.map((el) => {
            return {
              id: el.id,
              username: null,
              mapInfo: {
                title: el.name,
                coordinates: {
                  __typename: "Coordinates",
                  latitude: el.latLong._latitude,
                  longitude: el.latLong._longitude,
                }
              }
            }
          })
        )
      }
    } catch (err) {
      console.log(err)
    }

    return true
  }

  useFocusEffect(() => {
    if (!isRefreshed) {
      setIsRefreshed(true)
      refetch()
      fetchOtherPins()
    }
  })

  if (error) {
    toastShow(error.message)
  }

  let maps = data?.businessMapMarkers ?? []
  maps = maps.concat(otherPinData)

  const requestLocationPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: translate("MapScreen.locationPermissionTitle"),
          message: translate("MapScreen.locationPermissionMessage"),
          buttonNeutral: translate("MapScreen.locationPermissionNeutral"),
          buttonNegative: translate("MapScreen.locationPermissionNegative"),
          buttonPositive: translate("MapScreen.locationPermissionPositive"),
        },
      )
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log("You can use the location")
      } else {
        console.log("Location permission denied")
      }
    } catch (err) {
      console.warn(err)
    }
  }

  useFocusEffect(
    useCallback(() => {
      requestLocationPermission()
    }, []),
  )

  // React.useLayoutEffect(() => {
  //   navigation.setOptions(
  //     {
  //       title: route.params.title,
  //     },
  //     [],
  //   )
  // })

  const markers: JSX.Element[] = []
  maps.forEach((item) => {
    const onPress = () =>
      hasToken
        ? navigation.navigate("sendBitcoin", { username: item.username })
        : navigation.navigate("phoneValidation")
    markers.push(
      <Marker
        coordinate={item.mapInfo.coordinates}
        key={item.username || item.id}
        pinColor={palette.orange}
      >
        <Callout
          // alphaHitTest
          // tooltip
          onPress={() => (!!item.username && !isIos ? onPress() : null)}
        >
          <View style={styles.customView}>
            <Text style={styles.title}>{item.mapInfo.title}</Text>
            {!!item.username && !isIos && (
              <Button
                containerStyle={styles.android}
                title={translate("MapScreen.payBusiness")}
              />
            )}
            {isIos && (
              <CalloutSubview onPress={() => (item.username ? onPress() : null)}>
                {!!item.username && (
                  <Button style={styles.ios} title={translate("MapScreen.payBusiness")} />
                )}
              </CalloutSubview>
            )}
          </View>
        </Callout>
      </Marker>,
    )
  })

  return (
    <Screen>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: 9.1549238,
          longitude: -83.7570566,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        }}
      >
        {markers}
      </MapView>
    </Screen>
  )
}
