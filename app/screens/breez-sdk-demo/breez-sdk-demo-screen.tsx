import React, { useCallback, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { makeStyles, Text } from "@rn-vui/themed"

import { getInfo } from "./methods/wallet/get-info"
import { getSparkAddress } from "./methods/wallet/get-spark-address"
import { getDepositAddress } from "./methods/wallet/get-deposit-address"
import { getNetworkStatus } from "./methods/wallet/get-spark-status"
import { getUserSettings } from "./methods/wallet/get-user-settings"
import { listPayments } from "./methods/payments/list-payments"
import { createLightningInvoice } from "./methods/receive/create-lightning-invoice"
import { prepareLightningPayment } from "./methods/send/prepare-lightning-payment"
import { prepareOnchainPayment } from "./methods/send/prepare-onchain-payment"
import { prepareSparkPayment } from "./methods/send/prepare-spark-payment"
import { sendLightningPayment } from "./methods/send/send-lightning-payment"
import { sendOnchainPayment } from "./methods/send/send-onchain-payment"
import { sendSparkPayment } from "./methods/send/send-spark-payment"
import { formatError, stringifyWithBigInt } from "./utils"

type DemoMethod = () => Promise<object>

type SectionConfig = {
  title: string
  buttons: ReadonlyArray<{ label: string; method: DemoMethod }>
}

const SECTIONS: ReadonlyArray<SectionConfig> = [
  {
    title: "Wallet",
    buttons: [
      { label: "Get Info", method: getInfo },
      { label: "Spark Address", method: getSparkAddress },
      { label: "Deposit Address", method: getDepositAddress },
      { label: "Network Status", method: getNetworkStatus },
      { label: "User Settings", method: getUserSettings },
    ],
  },
  {
    title: "Payments",
    buttons: [{ label: "List Payments", method: listPayments }],
  },
  {
    title: "Receive",
    buttons: [
      {
        label: "Create Invoice (1000 sats)",
        method: () => createLightningInvoice(1000),
      },
    ],
  },
  {
    title: "Send — Lightning",
    buttons: [
      {
        label: "Prepare (9 sats)",
        method: () =>
          prepareLightningPayment(
            "lnbc1p5uck7cpp5jnceqce0yzga9f295n3lvunk7cswdhvg4hpax2ehjxerjtm8wvrqsp5l43qfy8ttptxtpwwzf48n9qygh9ks7jt8c4kgaadpae5kf8qf6nsxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpudqq9qyyssqusnmelk9u63a55vhp6904kwa5a70qm8nyamxa92jwjkmqh0fhr6x3lwv7ru3qlscrxz6zmnlyzp3uetnng0kq6r0kqpypm3pkmcrhqsp0t9uej",
            9,
          ),
      },
      {
        label: "Send (9 sats)",
        method: () =>
          sendLightningPayment(
            "lnbc1p5uck7cpp5jnceqce0yzga9f295n3lvunk7cswdhvg4hpax2ehjxerjtm8wvrqsp5l43qfy8ttptxtpwwzf48n9qygh9ks7jt8c4kgaadpae5kf8qf6nsxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpudqq9qyyssqusnmelk9u63a55vhp6904kwa5a70qm8nyamxa92jwjkmqh0fhr6x3lwv7ru3qlscrxz6zmnlyzp3uetnng0kq6r0kqpypm3pkmcrhqsp0t9uej",
            9,
          ),
      },
    ],
  },
  {
    title: "Send — On-chain",
    buttons: [
      {
        label: "Prepare (10 sats)",
        method: () => prepareOnchainPayment("PASTE_ADDRESS_HERE", 10),
      },
      {
        label: "Send (10 sats)",
        method: () => sendOnchainPayment("PASTE_ADDRESS_HERE", 10),
      },
    ],
  },
  {
    title: "Send — Spark",
    buttons: [
      {
        label: "Prepare (10 sats)",
        method: () =>
          prepareSparkPayment(
            "spark1pgss8g96acg7rwljvv33m57rs7wd9zxj4fd8xyetuhhqy7m2cyjqq0rxazfu3f",
            10,
          ),
      },
      {
        label: "Send (10 sats)",
        method: () =>
          sendSparkPayment(
            "spark1pgss8g96acg7rwljvv33m57rs7wd9zxj4fd8xyetuhhqy7m2cyjqq0rxazfu3f",
            10,
          ),
      },
    ],
  },
]

export const BreezSdkDemoScreen: React.FC = () => {
  const styles = useStyles()
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)

  const runMethod = useCallback(async (method: DemoMethod) => {
    setLoading(true)
    setResult("")
    try {
      const response = await method()
      setResult(
        stringifyWithBigInt(response as Parameters<typeof stringifyWithBigInt>[0]),
      )
    } catch (error) {
      setResult(formatError(error as Error))
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <Screen preset="scroll">
      <View style={styles.container}>
        <Text type="h1" style={styles.title}>
          Breez SDK Demo
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text type="h2" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <View style={styles.buttonContainer}>
              {section.buttons.map((btn) => (
                <GaloyPrimaryButton
                  key={btn.label}
                  title={btn.label}
                  onPress={() => runMethod(btn.method)}
                  disabled={loading}
                />
              ))}
            </View>
          </View>
        ))}

        {loading && <ActivityIndicator size="large" style={styles.loader} />}

        {result !== "" && (
          <ScrollView style={styles.resultContainer} nestedScrollEnabled>
            <Text style={styles.resultText}>{result}</Text>
          </ScrollView>
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    padding: 20,
  },
  title: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  buttonContainer: {
    gap: 10,
  },
  loader: {
    marginTop: 20,
  },
  resultContainer: {
    marginTop: 20,
    maxHeight: 400,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
}))
