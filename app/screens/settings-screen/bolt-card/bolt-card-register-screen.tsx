import * as React from "react"
import { useState, useEffect } from "react"
import { Alert, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native"
import { Button, Divider, Icon, Input } from "react-native-elements"
import { useMutation } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"

import { Screen } from "../../../components/screen"
import { translate } from "../../../i18n"
import { palette } from "../../../theme/palette"
import { RootStackParamList } from "../../../navigation/stack-param-lists"
import { BOLT_CARD_REGISTER_MUTATION, BOLT_CARDS_QUERY } from "../../../graphql/query"
import { generateBoltCardKeys } from "../../../utils/crypto"
import { scanCardUid } from "../../../utils/nfc"

type BoltCardRegisterScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "boltCardRegister">
}

export const BoltCardRegisterScreen: React.FC<BoltCardRegisterScreenProps> = ({ navigation }) => {
  const [registerCard, { loading }] = useMutation(BOLT_CARD_REGISTER_MUTATION)
  
  const [cardName, setCardName] = useState("")
  const [uid, setUid] = useState("")
  const [k0, setK0] = useState("")
  const [k1, setK1] = useState("")
  const [k2, setK2] = useState("")
  const [k3, setK3] = useState("")
  const [k4, setK4] = useState("")
  const [txLimit, setTxLimit] = useState("100000")
  const [dailyLimit, setDailyLimit] = useState("250000")
  const [keysGenerated, setKeysGenerated] = useState(false)
  const [scanningNfc, setScanningNfc] = useState(false)
  const [showKeyInputs, setShowKeyInputs] = useState(false)

  // Generate secure keys when the component mounts
  useEffect(() => {
    generateSecureKeys()
  }, [])

  const generateSecureKeys = async () => {
    try {
      const keys = await generateBoltCardKeys()
      setK0(keys.k0)
      setK1(keys.k1)
      setK2(keys.k2)
      setK3(keys.k3)
      setK4(keys.k4)
      setKeysGenerated(true)
    } catch (error) {
      console.error("Error generating secure keys:", error)
      Alert.alert(
        translate("common.error"),
        translate("BoltCardScreen.keyGenerationError")
      )
    }
  }

  const handleScanCard = async () => {
    setScanningNfc(true)
    try {
      const result = await scanCardUid()
      
      if (result.success && result.uid) {
        setUid(result.uid)
        // Alert.alert(
        //   translate("common.success"),
        //   translate("BoltCardScreen.cardScanned")
        // )
      } else {
        Alert.alert(
          translate("common.error"),
          translate(`nfc.${result.errorMessage}`)
        )
      }
    } catch (error) {
      console.error("Error scanning card:", error)
      Alert.alert(
        translate("common.error"),
        translate("BoltCardScreen.scanError")
      )
    } finally {
      setScanningNfc(false)
    }
  }

  const isFormValid = () => {
    return (
      cardName.trim() !== "" &&
      uid.trim() !== "" &&
      k0.trim().length === 32 &&
      k1.trim().length === 32 &&
      k2.trim().length === 32 &&
      k3.trim().length === 32 &&
      k4.trim().length === 32 &&
      !isNaN(parseInt(txLimit)) &&
      !isNaN(parseInt(dailyLimit))
    )
  }

  const handleRegister = async () => {
    if (!isFormValid()) {
      Alert.alert(
        translate("common.error"),
        translate("BoltCardScreen.invalidFormData"),
      )
      return
    }

    try {
      const { data } = await registerCard({
        variables: {
          input: {
            cardName: cardName.trim(),
            uid: uid.trim(),
            k0: k0.trim(),
            k1: k1.trim(),
            k2: k2.trim(),
            k3: k3.trim(),
            k4: k4.trim(),
            limits: {
              tx: parseInt(txLimit),
              daily: parseInt(dailyLimit),
            },
          },
        },
        refetchQueries: [{ query: BOLT_CARDS_QUERY }],
      })

      if (data.boltCardRegister.errors.length > 0) {
        Alert.alert(
          translate("common.error"),
          data.boltCardRegister.errors[0].message,
        )
        return
      }

      Alert.alert(
        translate("common.success"),
        translate("BoltCardScreen.cardRegistered"),
        [
          {
            text: translate("common.ok"),
            onPress: () => navigation.navigate("boltCardPair", { cardId: data.boltCardRegister.boltCard.id, cardUID: data.boltCardRegister.boltCard.uid }),
          },
        ],
      )
    } catch (err) {
      Alert.alert(translate("common.error"), err.toString())
    }
  }

  const renderKeyInput = (label: string, value: string, setValue: (value: string) => void) => {
    return (
      <View style={styles.keyInputContainer}>
        <Input
          label={label}
          value={value}
          onChangeText={setValue}
          placeholder={translate("BoltCardScreen.keyPlaceholder")}
          autoCapitalize="none"
          maxLength={32}
          disabled={false}
          style={keysGenerated ? styles.generatedKeyInput : {}}
        />
        {keysGenerated && (
          <Icon
            name="check-circle"
            type="material-community"
            color={palette.green}
            size={20}
            containerStyle={styles.keyCheckIcon}
          />
        )}
      </View>
    )
  }

  const toggleKeyInputs = () => {
    setShowKeyInputs(!showKeyInputs)
  }

  return (
    <Screen preset="scroll">
      <ScrollView>
        <View style={styles.header}>
          <Icon
            name="card-plus-outline"
            type="material-community"
            size={48}
            color={palette.darkGrey}
          />
          <Text style={styles.headerTitle}>{translate("BoltCardScreen.registerNewCard")}</Text>
          <Text style={styles.headerSubtitle}>
            {translate("BoltCardScreen.registerCardDescription")}
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label={translate("BoltCardScreen.cardName")}
            value={cardName}
            onChangeText={setCardName}
            placeholder={translate("BoltCardScreen.cardNamePlaceholder")}
            autoCapitalize="none"
          />

          <View style={styles.uidContainer}>
            <Input
              label={translate("BoltCardScreen.uid")}
              value={uid}
              onChangeText={setUid}
              placeholder={translate("BoltCardScreen.uidPlaceholder")}
              autoCapitalize="none"
              containerStyle={styles.uidInput}
            />
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={handleScanCard}
              disabled={scanningNfc}
            >
              <Icon
                name="nfc"
                type="material-community"
                color={scanningNfc ? palette.lightGrey : palette.blue}
                size={24}
              />
              <Text style={[
                styles.scanButtonText, 
                scanningNfc && styles.scanButtonTextDisabled
              ]}>
                {scanningNfc 
                  ? translate("BoltCardScreen.scanning") 
                  : translate("BoltCardScreen.scanCard")}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{translate("BoltCardScreen.spendingLimits")}</Text>
          <Divider style={styles.divider} />

          <Input
            label={translate("BoltCardScreen.txLimit")}
            value={txLimit}
            onChangeText={setTxLimit}
            placeholder="10000"
            keyboardType="numeric"
            rightIcon={<Text style={styles.satLabel}>sats</Text>}
          />

          <Input
            label={translate("BoltCardScreen.dailyLimit")}
            value={dailyLimit}
            onChangeText={setDailyLimit}
            placeholder="100000"
            keyboardType="numeric"
            rightIcon={<Text style={styles.satLabel}>sats</Text>}
          />

          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>{translate("BoltCardScreen.cardKeys")}</Text>
            <TouchableOpacity 
              style={styles.regenerateButton} 
              onPress={generateSecureKeys}
            >
              <Icon
                name="refresh"
                type="material-community"
                color={palette.blue}
                size={16}
              />
              <Text style={styles.regenerateText}>
                {translate("BoltCardScreen.regenerateKeys")}
              </Text>
            </TouchableOpacity>
          </View>
          <Divider style={styles.divider} />
          
          <TouchableOpacity 
            style={styles.keysInfoContainer}
            onPress={toggleKeyInputs}
            activeOpacity={0.7}
          >
            <Icon
              name="shield-check"
              type="material-community"
              color={palette.white}
              size={20}
            />
            <Text style={styles.keysInfoText}>
              {translate("BoltCardScreen.secureKeysGenerated")}
            </Text>
            <Icon
              name={showKeyInputs ? "chevron-up" : "chevron-down"}
              type="material-community"
              color={palette.white}
              size={20}
            />
          </TouchableOpacity>

          {showKeyInputs && (
            <>
              {renderKeyInput("K0", k0, setK0)}
              {renderKeyInput("K1", k1, setK1)}
              {renderKeyInput("K2", k2, setK2)}
              {renderKeyInput("K3", k3, setK3)}
              {renderKeyInput("K4", k4, setK4)}
            </>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            title={translate("BoltCardScreen.registerCard")}
            onPress={handleRegister}
            disabled={!isFormValid() || loading}
            loading={loading}
            buttonStyle={styles.registerButton}
          />
          <Button
            title={translate("common.cancel")}
            onPress={() => navigation.goBack()}
            buttonStyle={styles.cancelButton}
            titleStyle={styles.cancelButtonText}
            type="outline"
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    padding: 20,
    backgroundColor: palette.lighterGrey,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
    color: palette.darkGrey,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.midGrey,
    marginTop: 5,
    textAlign: "center",
  },
  form: {
    padding: 15,
  },
  uidContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 15,
  },
  uidInput: {
    flex: 1,
  },
  scanButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.lightGrey,
    borderRadius: 8,
    width: 80,
  },
  scanButtonText: {
    fontSize: 12,
    color: palette.blue,
    marginTop: 5,
    textAlign: "center",
  },
  scanButtonTextDisabled: {
    color: palette.lightGrey,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: palette.darkGrey,
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  regenerateText: {
    fontSize: 14,
    color: palette.blue,
    marginLeft: 5,
  },
  divider: {
    backgroundColor: palette.lighterGrey,
    marginBottom: 10,
  },
  keysInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.green,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  keysInfoText: {
    fontSize: 14,
    color: palette.white,
    marginLeft: 10,
    flex: 1,
  },
  keyInputContainer: {
    position: "relative",
  },
  generatedKeyInput: {
    color: palette.midGrey,
    backgroundColor: palette.lighterGrey,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  keyCheckIcon: {
    position: "absolute",
    right: 10,
    top: 20,
  },
  satLabel: {
    color: palette.midGrey,
    marginRight: 10,
  },
  buttonContainer: {
    padding: 20,
    marginTop: 10,
  },
  registerButton: {
    backgroundColor: palette.green,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 10,
    borderRadius: 8,
    borderColor: palette.midGrey,
  },
  cancelButtonText: {
    color: palette.midGrey,
  },
}) 