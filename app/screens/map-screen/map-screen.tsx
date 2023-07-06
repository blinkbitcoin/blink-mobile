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
import Icon from "react-native-vector-icons/Ionicons"

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

  title: { 
    color: palette.darkGrey, 
    fontSize: 18,
  },

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
  },

  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  reportButton: {
    backgroundColor: "#FF0000"
  }

})

type Props = {
  navigation: StackNavigationProp<PrimaryStackParamList, "Map">
}

export const MapScreen: ScreenType = ({ navigation }: Props) => {
  const { hasToken } = useToken()
  const [isRefreshed, setIsRefreshed] = React.useState(false)
  const [pinData, setPinData] = React.useState([])
  const [showModal, setShowModal] = React.useState(false)
  const [showReportModal, setShowReportModal] = React.useState(false)
  const [newPinCoordinates, setNewPinCoordinates] = React.useState(null)
  const [businessName, setBusinessName] = React.useState("")
  const [problemDescription, setProblemDescription] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const { username } = useMainQuery()

  const handleSendAction = (item) => {
    hasToken
      ? navigation.navigate("sendBitcoin", { username: item.bitcoinJungleUsername })
      : navigation.navigate("phoneValidation")
  }

  const fetchPins = async () => {
    try {
      const res = await fetch('https://us-central1-bitcoin-jungle-maps.cloudfunctions.net/location-list?includeMigrated=true')
      const data = await res.json()

      if(res.ok) {
        setPinData(data)
      }
    } catch (err) {
      console.log(err)
    }

    return true
  }

  useFocusEffect(() => {
    if (!isRefreshed) {
      setIsRefreshed(true)
      fetchPins()
    }
  })

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

  const reportProblem = async () => {
    setLoading(true)

    const res = await fetch("https://maps.bitcoinjungle.app/api/report", {
      "method": "POST",
      "headers": {
        "Content-Type": "application/json; charset=utf-8"
      },
      "body": JSON.stringify({
        id: showReportModal.id,
        description: problemDescription,
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
      setShowReportModal(false)
      setProblemDescription("")
      fetchPins()
      setIsRefreshed(false)

      Alert.alert(translate("MapScreen.reportSuccess"), "", [
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
  pinData.forEach((item) => {
    const onPress = () => {
      Alert.alert(item.name, translate("MapScreen.actionAlertMessage"), [
        {
          text: translate("SendBitcoinScreen.title"),
          onPress: () => {
            handleSendAction(item)
          },
        },
        {
          text: translate("MapScreen.reportModalTitle"),
          onPress: () => {
            setShowReportModal(item)
          },
        },
      ])
    }
    markers.push(
      <Marker
        coordinate={{latitude: item.latLong._latitude, longitude: item.latLong._longitude}}
        key={item.id || item.bitcoinJungleUsername}
        pinColor={palette.orange}
      >
        <Callout
          // alphaHitTest
          // tooltip
          onPress={() => (!isIos ? onPress() : null)}
        >
          <View style={styles.customView}>
            <Text style={styles.title}>
              {item.name}
            </Text>
              
            <View style={styles.buttonsContainer}>
              {!isIos && (
                <Button
                  containerStyle={styles.android}
                  title={
                    <Icon
                      name="send-outline"
                      size={24}
                      color={palette.white}
                    />
                  }
                />
              )}
              {isIos && (
                <>
                  <CalloutSubview onPress={() => (item.bitcoinJungleUsername ? handleSendAction(item) : null)}>
                    {!!item.bitcoinJungleUsername && (
                      <Button style={styles.ios} title={
                          <Icon
                            name="send-outline"
                            size={24}
                            color={palette.white}
                          />
                        }
                      />
                    )}
                  </CalloutSubview>
                
                  <Text style={{width: 10}}></Text>
                  <CalloutSubview 
                    onPress={() => {
                      setShowReportModal(item)
                    }}
                  >
                    <Button
                      buttonStyle={styles.reportButton}
                      containerStyle={styles.ios}
                      title={
                        <Icon
                          name="alert-circle-outline"
                          size={24}
                          color={palette.white}
                        />
                      }
                    />
                  </CalloutSubview>
                </>
              )}
            </View>
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
      {showReportModal &&
        <Modal
          animationType="slide"
          transparent={true}
          visible={typeof showReportModal === "object" ? true : false}
          onRequestClose={() => setShowReportModal(!showReportModal)}>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
            <Text style={styles.modalText}>
                {translate("MapScreen.reportModalTitle")}
              </Text>
              <Text style={styles.modalText}>
                {translate("MapScreen.reportModalText", {name: showReportModal.name})}
              </Text>

              <TextInput
                style={styles.input}
                placeholder={translate("MapScreen.problemDescription")}
                placeholderTextColor="#000000"
                onChangeText={setProblemDescription}
                value={problemDescription}
              />

              <View style={{ flexDirection:"row" }}>
                <Button
                  title={translate("common.cancel")}
                  buttonStyle={styles.cancelButton}
                  disabled={loading}
                  onPress={() => {
                    setShowReportModal(false)
                    setProblemDescription("")
                  }}>
                </Button>

                <Button
                  title={translate("MapScreen.reportModalButton")}
                  disabled={loading}
                  buttonStyle={styles.addButton}
                  onPress={reportProblem}>
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      }
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
