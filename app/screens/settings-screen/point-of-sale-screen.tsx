/* eslint-disable react-native/no-inline-styles */
import { gql, useLazyQuery } from "@apollo/client"
import * as React from "react"
import { RouteProp } from "@react-navigation/native"
import { ActivityIndicator, Pressable, View, TextInput, Linking } from "react-native"
import { StackNavigationProp } from "@react-navigation/stack"
import EStyleSheet from "react-native-extended-stylesheet"
import debounce from "lodash.debounce"

import { Screen } from "../../components/screen"
import { Dropdown } from "../../components/dropdown"
import { palette } from "../../theme/palette"
import { GaloyInput } from "../../components/galoy-input"
import * as UsernameValidation from "../../utils/validation"

import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"

import { Button, Text, ListItem } from "react-native-elements"
import Clipboard from "@react-native-clipboard/clipboard"
import Toast from "react-native-root-toast"
import { translate } from "@app/i18n"
import { color } from "@app/theme"

import useMainQuery from "@app/hooks/use-main-query"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

import Icon from "react-native-vector-icons/MaterialCommunityIcons"

import { CREATE_POS_API_KEY } from "../../constants/support"

const styles = EStyleSheet.create({
  container: {
    backgroundColor: palette.white,
    minHeight: "100%",
    paddingLeft: 24,
    paddingRight: 24,
  },
  buttonStyle: {
    backgroundColor: color.primary,
    marginBottom: "10rem",
    marginHorizontal: "10rem",
    marginTop: "10rem",
  },
  secondaryButtonStyle: {
    backgroundColor: palette.midGrey,
    marginBottom: "10rem",
    marginHorizontal: "10rem",
    marginTop: "10rem",
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
  title: {
    fontWeight: "bold",
    fontSize: 24,
    paddingBottom: 10,
    paddingTop: 10,

  },
  text: {
    paddingBottom: 5,
  }
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "pointOfSale">
  route: RouteProp<RootStackParamList, "pointOfSale">
}

const copyToClipboard = (str, openURL) => {
  const link = `https://btcpayserver.bitcoinjungle.app/apps/${str}/pos`

  Clipboard.setString(link)

  Toast.show(translate("tippingLink.copied", {data: translate("PointOfSaleScreen.link")}), {
    duration: Toast.durations.LONG,
    shadow: false,
    animation: true,
    hideOnPress: true,
    delay: 0,
    position: -100,
    opacity: 0.5,
  })

  if(openURL) {
    Linking.openURL(link)
  }
}

const USER_WALLET_ID = gql`
  query userDefaultWalletId($username: Username!) {
    userDefaultWalletId(username: $username)
  }
`

export const PointOfSaleScreen: ScreenType = ({ route }: Props) => {
  const { username } = useMainQuery()

  const [
    userDefaultWalletIdQuery,
    { loading: loadingUserDefaultWalletId, data: dataUserDefaultWalletId, variables },
  ] = useLazyQuery(USER_WALLET_ID, {
    fetchPolicy: "network-only",
    onCompleted: (dataUserDefaultWalletId) => {
      if (dataUserDefaultWalletId?.userDefaultWalletId) {
        setTipUsername(variables.username, false, true)
      }
    },
    onError: () => {
      setTipUsername(variables.username, false, false)
    },
  })

  const userDefaultWalletIdQueryDebounced = React.useCallback(
    debounce(async (destination) => {
      userDefaultWalletIdQuery({ 
        variables: { 
          username: destination.username 
        } 
      })
    }, 1500),
    [],
  )

  const [ loading, setLoading ] = React.useState(false)
  const [ showForm, setShowForm ] = React.useState(false)
  const [ storeName, setStoreName ] = React.useState("")
  const [ storeOwnerEmail, setStoreOwnerEmail ] = React.useState("")
  const [ defaultCurrency, setDefaultCurrency ] = React.useState("CRC")
  const [ defaultLanguage, setDefaultLanguage ] = React.useState("en")
  const [ tipUsernames, setTipUsernames ] = React.useState([{username: "", isValid: null}])

  const [ storeData, setStoreData ] = React.useState([])

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const data = await KeyStoreWrapper.getPointOfSales()

        if (data) {
          setStoreData(data)
        }
      } catch (e) {
        console.log(e)
      }
    }

    loadData()  
  }, [])

  React.useEffect(() => {
    const newTipUsername = tipUsernames[tipUsernames.length - 1]
    if (UsernameValidation.hasValidLength(newTipUsername.username) && UsernameValidation.isValid(newTipUsername.username) && newTipUsername.isValid == null) {
      userDefaultWalletIdQueryDebounced(newTipUsername)
    }
  }, [tipUsernames])

  const addTipUsername = () => {
    const newTipUsernames = [...tipUsernames]
    newTipUsernames.push({username: "", isValid: null})

    setTipUsernames(newTipUsernames)
  }

  const setTipUsername = (username, index, isValid) => {
    const newTipUsernames = [...tipUsernames]

    if(index === false) {
      index = tipUsernames.findIndex((el) => el.username === username)
    }

    let updateObj = {
      username: username,
      isValid: (typeof isValid != 'undefined' ? isValid : newTipUsernames[index].isValid)
    }

    newTipUsernames[index] = updateObj

    setTipUsernames(newTipUsernames)
  }

  const deleteTipUsername = (index) => {
    const newTipUsernames = [...tipUsernames]

    newTipUsernames.splice(index, 1)

    if(!newTipUsernames.length) {
      newTipUsernames[0] = {username: "", isValid: null}
    }

    setTipUsernames(newTipUsernames)
  }

  const createPointOfSale = async () => {
    try {
      setLoading(true)

      let data = null
      const res = await fetch("https://btcpayserver.bitcoinjungle.app/addStore", {
        "method": "POST",
        "headers": {
          "Content-Type": "application/json; charset=utf-8"
        },
        "body": JSON.stringify({
          apiKey: CREATE_POS_API_KEY,
          storeName,
          storeOwnerEmail,
          defaultCurrency,
          defaultLanguage,
          rate: 1,
          bitcoinJungleUsername: username,
          tipSplit: tipUsernames.map((el) => el.username),
        })
      })

      if(res) {
        data = await res.json()
      }

      if(data) {
        if(data.error) {
          throw new Error(data.message)
        }

        const newStore = {
          id: data.btcPayServerAppId,
          name: storeName,
        }

        const newStoreData = [...storeData, newStore]

        setStoreData(newStoreData)

        copyToClipboard(data.btcPayServerAppId)

        setShowForm(false)
        setStoreOwnerEmail("")
        setStoreName("")
        setDefaultCurrency("CRC")
        setDefaultLanguage("en")
        setTipUsernames([{username: "", isValid: null}])

        await KeyStoreWrapper.setPointOfSales(newStoreData)
      } else {
        throw new Error(translate("errors.unexpectedError"))
      }
    } catch(e) {
      Toast.show(e.toString(), {
        duration: Toast.durations.LONG,
        shadow: false,
        animation: true,
        hideOnPress: true,
        delay: 0,
        position: -100,
        opacity: 0.5,
      })
    }

    setLoading(false)
  }

  const tipInputRightIcon = (obj) => {
    if (UsernameValidation.hasValidLength(obj.username) && UsernameValidation.isValid(obj.username) && obj.isValid == null) {
      return <ActivityIndicator size="small" />
    }

    if(obj.isValid == null) {
      return <Text></Text>
    }

    if(!obj.isValid) {
      return <Text>⚠️</Text>
    }

    if(obj.isValid) {
      return <Text>✅</Text>
    }
  }

  return (
    <Screen style={styles.container} preset="scroll">
      <View>
        {!showForm &&
          <Button
            buttonStyle={styles.buttonStyle}
            containerStyle={{ flex: 1 }}
            title={translate("PointOfSaleScreen.create")}
            onPress={() => setShowForm(true)}
          />
        }
        {showForm &&
          <View>
            <TextInput
              style={styles.input}
              onChangeText={setStoreOwnerEmail}
              value={storeOwnerEmail}
              placeholder={translate("common.email")}
               placeholderTextColor="#000000"
            />

            <TextInput
              style={styles.input}
              onChangeText={setStoreName}
              value={storeName}
              placeholder={translate("PointOfSaleScreen.storeName")}
              placeholderTextColor="#000000" 
            />

            <Dropdown label={translate("PointOfSaleScreen.currency")} data={[{label: "CRC", value: "CRC"},{label: "USD", value: "USD"}]} onSelect={setDefaultCurrency} />

            <Dropdown label={translate("common.language")} data={[{label: "English", value: "en"},{label: "Español", value: "es"}]} onSelect={setDefaultLanguage} />

            {tipUsernames.map((obj, i) => {
              return (
                <GaloyInput
                  placeholder={"Tip Recipient Username"}
                  placeholderTextColor="#000000" 
                  onChangeText={(val) => {
                    setTipUsername(val, i)
                  }}
                  leftIcon={
                    <Icon 
                      name={"delete"}
                      size={20}
                      onPress={() => {
                        deleteTipUsername(i)
                      } }
                    />
                  }
                  rightIcon={tipInputRightIcon(tipUsernames[i])}
                  value={tipUsernames[i].username}
                  editable
                  autoCompleteType="username"
                  autoCapitalize="none"
                />
              )
            })}

            <Button
              buttonStyle={styles.secondaryButtonStyle}
              containerStyle={{ flex: 1 }}
              title={"Add another Tip User"}
              onPress={addTipUsername}
              disabled={loading}
            />

            <Button
              buttonStyle={styles.buttonStyle}
              containerStyle={{ flex: 1 }}
              title={translate("PointOfSaleScreen.create")}
              onPress={createPointOfSale}
              disabled={loading}
            />
          </View>
        }
      </View>
      <View>
        <Text style={styles.title}>
          {translate("PointOfSaleScreen.myTitle")}
        </Text>
        {storeData.length === 0 && 
          <Text>{translate("PointOfSaleScreen.none")}</Text>
        }
        {
          storeData.map((el) => {
            return (
             <ListItem key={el.id} bottomDivider onPress={() => copyToClipboard(el.id, true)}>
              <Icon name={"compass-outline"} size={20} />
              <ListItem.Content>
                <ListItem.Title>{el.name}</ListItem.Title>
              </ListItem.Content>
              </ListItem>
            )
          })
        }
      </View>
    </Screen>
  )
}
