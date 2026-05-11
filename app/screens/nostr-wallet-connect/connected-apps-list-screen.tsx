import React, { useState } from "react"
import { Pressable, ScrollView, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { InputField } from "@app/components/card-screen/input-field"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { SettingsRow } from "@app/screens/settings-screen/row"
import { toBtcMoneyAmount } from "@app/types/amounts"

import { useNwcConnections } from "./hooks"

// TODO: remove when backend integration is ready
const MOCK_CONNECTIONS = [
  {
    id: "mock-1",
    appName: "BTCpayserver",
    dailyBudgetSats: 10_000,
    connectionString: "nostr+walletconnect://mock",
    createdAt: Date.now(),
  },
]

export const NwcConnectedAppsListScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { connections: hookConnections, removeConnection } = useNwcConnections()

  const connections = hookConnections.length > 0 ? hookConnections : MOCK_CONNECTIONS
  const [threshold, setThreshold] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<string | undefined>()
  const targetConnection = connections.find((c) => c.id === deleteTarget)

  const formatSatsDisplay = (val: string) =>
    formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(Number(val) || 0) })

  const formatBudget = (sats: number) =>
    LL.NostrWalletConnect.budget({
      amount: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(sats) }),
    })

  const handleDelete = () => {
    if (!deleteTarget) return
    removeConnection(deleteTarget)
    setDeleteTarget(undefined)
    if (connections.length - 1 <= 0) {
      navigation.replace("nwcEmptyState")
    }
  }

  const deleteModalBody = targetConnection ? (
    <Text style={styles.modalBody}>
      {LL.NostrWalletConnect.deleteConfirmBody({
        appName: targetConnection.appName,
      })}
    </Text>
  ) : null

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{LL.NostrWalletConnect.connectedApps()}</Text>
          <View style={styles.sectionContent}>
            {connections.map((connection) => (
              <SettingsRow
                key={connection.id}
                title={connection.appName}
                subtitle={formatBudget(connection.dailyBudgetSats)}
                rightIcon={
                  <Pressable onPress={() => setDeleteTarget(connection.id)}>
                    <GaloyIcon name="close" size={16} color={colors.red} />
                  </Pressable>
                }
                action={null}
              />
            ))}
          </View>
        </View>

        <InputField
          label={LL.NostrWalletConnect.doNotNotifyBelow()}
          value={String(threshold)}
          onChangeText={(text) => setThreshold(Number(text) || 0)}
          keyboardType="number-pad"
          rightIcon="pencil"
          formatDisplay={formatSatsDisplay}
        />
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.NostrWalletConnect.newConnection()}
          onPress={() => navigation.navigate("nwcNewConnection")}
        />
      </View>

      {targetConnection && (
        <CustomModal
          isVisible={deleteTarget !== undefined}
          toggleModal={() => setDeleteTarget(undefined)}
          image={<GaloyIcon name="warning-circle" size={52} color={colors.primary} />}
          title={LL.NostrWalletConnect.deleteConfirmTitle()}
          body={deleteModalBody}
          primaryButtonTitle={LL.NostrWalletConnect.dismiss()}
          primaryButtonOnPress={() => setDeleteTarget(undefined)}
          secondaryButtonTitle={LL.common.yes()}
          secondaryButtonOnPress={handleDelete}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
  section: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  sectionContent: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
