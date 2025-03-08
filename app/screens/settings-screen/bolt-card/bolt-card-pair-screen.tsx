import * as React from "react"
import { useState, useEffect } from "react"
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native"
import { Button, Icon } from "react-native-elements"
import { useMutation } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp } from "@react-navigation/native"

import { Screen } from "../../../components/screen"
import { translate } from "../../../i18n"
import { palette } from "../../../theme/palette"
import { RootStackParamList } from "../../../navigation/stack-param-lists"
import { BOLT_CARD_PAIR_MUTATION, BOLT_CARDS_QUERY, BOLT_CARD_GENERATE_OTP_MUTATION } from "../../../graphql/query"
import SetupBoltcard from "../../../components/setup-boltcard/setup-boltcard"

type BoltCardPairScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "boltCardPair">
  route: RouteProp<RootStackParamList, "boltCardPair">
}

interface CardKeys {
  K0: string;
  K1: string;
  K2: string;
  K3: string;
  K4: string;
  LNURLW: string;
}

export const BoltCardPairScreen: React.FC<BoltCardPairScreenProps> = ({ navigation, route }) => {
  const { cardId, cardUID } = route.params
  const [pairCard] = useMutation(BOLT_CARD_PAIR_MUTATION)
  const [generateOTP] = useMutation(BOLT_CARD_GENERATE_OTP_MUTATION)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [cardKeys, setCardKeys] = useState<CardKeys | null>(null)
  const [isProgramming, setIsProgramming] = useState(false)
  const [pairingComplete, setPairingComplete] = useState(false)

  // Start the pairing process when the component mounts
  useEffect(() => {
    startPairingProcess()
  }, [])

  const startPairingProcess = async () => {
    try {
      setIsLoading(true)
      setError("")
      
      // Step 1: Generate OTP
      console.log("Generating OTP for card", cardId)
      const otpResponse = await generateOTP({
        variables: {
          input: {
            cardId,
          },
        },
      })
      
      if (otpResponse.data.boltCardGenerateOtp.errors?.length > 0) {
        throw new Error(otpResponse.data.boltCardGenerateOtp.errors[0].message)
      }
      
      const otp = otpResponse.data.boltCardGenerateOtp.otp
      console.log("OTP generated:", otp)
      
      // Step 2: Pair the card with the OTP
      console.log("Pairing card with OTP")
      const pairResponse = await pairCard({
        variables: {
          input: {
            otp,
            baseUrl: "https://pay.bitcoinjungle.app"
          },
        },
        refetchQueries: [{ query: BOLT_CARDS_QUERY }],
      })
      
      if (pairResponse.data.boltCardPair.errors?.length > 0) {
        throw new Error(pairResponse.data.boltCardPair.errors[0].message)
      }
      
      // Step 3: Extract card keys
      const { k0, k1, k2, k3, k4, lnurlwBase } = pairResponse.data.boltCardPair
      console.log("Card keys received:", { k0, k1, k2, k3, k4, lnurlwBase })
      
      if (!k0 || !k1 || !k2 || !k3 || !k4 || !lnurlwBase) {
        throw new Error("Required card keys are missing from server response")
      }
      
      // Step 4: Set card keys and mark pairing as complete
      setPairingComplete(true)
      setCardKeys({
        K0: k0,
        K1: k1,
        K2: k2,
        K3: k3,
        K4: k4,
        LNURLW: lnurlwBase
      })
      
      setIsLoading(false)
      // Don't automatically start programming, let user choose from options
      setIsProgramming(false)
    } catch (err) {
      console.error("Error in pairing process:", err)
      setError(err.toString())
      setIsLoading(false)
      Alert.alert(translate("common.error"), err.toString())
    }
  }

  const handleCancel = () => {
    navigation.goBack()
  }

  const handleRetry = () => {
    setError("")
    setCardKeys(null)
    setPairingComplete(false)
    setIsProgramming(false)
    startPairingProcess()
  }

  return (
    <Screen preset="scroll">
      <ScrollView>
        <View style={styles.header}>
          <Icon
            name="nfc"
            type="material-community"
            size={48}
            color={palette.darkGrey}
          />
          <Text style={styles.headerTitle}>{translate("BoltCardScreen.programCard")}</Text>
          <Text style={styles.headerSubtitle}>
            {translate("BoltCardScreen.programCardDescription")}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{translate("BoltCardScreen.fetchingOTP")}</Text>
            <ActivityIndicator size="large" color={palette.blue} style={{ marginTop: 10 }} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title={translate("common.retry")}
              onPress={handleRetry}
              buttonStyle={styles.retryButton}
            />
          </View>
        ) : pairingComplete && cardKeys ? (
          <SetupBoltcard 
            cardKeys={cardKeys} 
            initialCardUID={cardUID} 
            startCardProgramming={isProgramming}
            cardId={cardId}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{translate("BoltCardScreen.preparingCard")}</Text>
            <ActivityIndicator size="large" color={palette.blue} style={{ marginTop: 10 }} />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={translate("common.cancel")}
            onPress={handleCancel}
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
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: palette.darkGrey,
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: palette.red,
    marginBottom: 15,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: palette.blue,
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  buttonContainer: {
    padding: 20,
    marginTop: 10,
  },
  cancelButton: {
    borderRadius: 8,
    borderColor: palette.midGrey,
  },
  cancelButtonText: {
    color: palette.midGrey,
  },
}) 