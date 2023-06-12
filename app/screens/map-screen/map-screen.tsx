import { gql, useQuery } from "@apollo/client"
import { useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { useCallback } from "react"
// eslint-disable-next-line react-native/split-platform-components
import { PermissionsAndroid, StyleSheet, Text, View, Modal, TextInput, Alert } from "react-native"
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
import { color } from "@app/theme"
import useMainQuery from "@app/hooks/use-main-query"

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

  centeredView: {
    marginTop: 100,
  },

  modalView: {
    margin: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  modalText: {
    margin: 5,
    textAlign: 'center',
  },

  input: {
    height: 40,
    margin: 10,
    borderWidth: 1,
    width: "90%",
    padding: 5
  },

  cancelButton: {
    margin: 5,
    backgroundColor: palette.darkGrey,
  },

  addButton: {
    margin: 5,
    backgroundColor: color.primary,
  }

})

type Props = {
  navigation: StackNavigationProp<PrimaryStackParamList, "Map">
}

export const MapScreen: ScreenType = ({ navigation }: Props) => {
  const { hasToken } = useToken()
  const [isRefreshed, setIsRefreshed] = React.useState(false)
  const [otherPinData, setOtherPinData] = React.useState([])
  const [showModal, setShowModal] = React.useState(false)
  const [newPinCoordinates, setNewPinCoordinates] = React.useState(null)
  const [businessName, setBusinessName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const { username } = useMainQuery()
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
              username: el.bitcoinJungleUsername,
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

  const handleMapOnPress = (e) => {
    if(showModal) {
      setNewPinCoordinates(e.nativeEvent.coordinate)
    }
  }

  const addToMap = async () => {
    setLoading(true)

    const res = await fetch("https://maps.bitcoinjungle.app/api/add", {
      "method": "POST",
      "headers": {
        "Content-Type": "application/json; charset=utf-8"
      },
      "body": JSON.stringify({
        name: businessName,
        latitude: newPinCoordinates.latitude,
        longitude: newPinCoordinates.longitude,
        acceptsOnChain: true,
        acceptsLightning: true,
        bitcoinJungleUsername: username,
      })
    })

    const resData = await res.json()

    if(!res.ok) {
      Alert.alert(`Error! ${resData.error}`, "", [
        {
          text: translate("common.ok"),
          onPress: () => {
            // here
          },
        },
      ])
    } else {
      setShowModal(!showModal)
      setNewPinCoordinates(null)
      setBusinessName("")

      Alert.alert(translate("MapScreen.successText"), "", [
        {
          text: translate("common.ok"),
          onPress: () => {
            // here
          },
        },
      ])
    }

    setLoading(false)
  }

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
      <Button
        title={!showModal ? 
          translate("MapScreen.addToMap") : 
          !newPinCoordinates ? 
          translate("MapScreen.addingToMap") : 
          translate("MapScreen.finishAddingToMap")
        }
        onPress={() => setShowModal(!showModal)}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={showModal && newPinCoordinates !== null}
        onRequestClose={() => setShowModal(!showModal)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{translate("MapScreen.modalTitle")}</Text>
            <Text style={styles.modalText}>{translate("MapScreen.modalText")}</Text>

            <TextInput
              style={styles.input}
              placeholder={translate("common.businessName")}
              placeholderTextColor="#000000"
              onChangeText={setBusinessName}
              value={businessName}
            />

            <View style={{ flexDirection:"row" }}>
              <Button
                title={translate("common.cancel")}
                buttonStyle={styles.cancelButton}
                disabled={loading}
                onPress={() => {
                  setShowModal(!showModal)
                  setNewPinCoordinates(null)
                  setBusinessName("")

                }}>
              </Button>

              <Button
                title={translate("MapScreen.addToMap")}
                disabled={loading}
                buttonStyle={styles.addButton}
                onPress={addToMap}>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        onPress={handleMapOnPress}
        initialRegion={{
          latitude: 9.1549238,
          longitude: -83.7570566,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        }}
      >
        {!showModal && markers}
        {newPinCoordinates &&
          <Marker
            coordinate={newPinCoordinates}
            key={'new-pin'}
            pinColor={palette.red}
          />
        }
      </MapView>
    </Screen>
  )
}
