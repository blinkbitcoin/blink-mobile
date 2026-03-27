import React from "react"
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import QRCode from "react-native-qrcode-svg"

import Logo from "@app/assets/logo/blink-logo-icon.png"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const NwcConnectionCreatedScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "nwcConnectionCreated">>()
  const { connectionString } = route.params
  const { copyToClipboard } = useClipboard()

  const handleCopy = () => {
    copyToClipboard({
      content: connectionString,
      message: LL.NostrWalletConnect.nwcStringCopied(),
    })
  }

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Primary" }, { name: "nwcConnectedApps" }],
    })
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={connectionString}
              size={180}
              backgroundColor="white"
              color="black"
              logoSize={60}
            />
            <View style={styles.logoOverlay}>
              <View style={styles.logoCircle}>
                <Image source={Logo} style={styles.logoImage} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {LL.NostrWalletConnect.connectionCreated()}
            </Text>
          </View>
        </View>

        <View style={styles.connectionStringSection}>
          <Text style={styles.sectionLabel}>
            {LL.NostrWalletConnect.nwcConnectionString()}
          </Text>
          <Pressable style={styles.connectionStringCard} onPress={handleCopy}>
            <Text style={styles.connectionStringText} numberOfLines={5}>
              {connectionString}
            </Text>
            <GaloyIcon name="copy-paste" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.instructionText}>
          {LL.NostrWalletConnect.copyInstruction()}
        </Text>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={LL.NostrWalletConnect.done()} onPress={handleDone} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  qrContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  qrWrapper: {
    backgroundColor: colors._white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey5,
    padding: 20,
  },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors._white,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  badgeContainer: {
    alignItems: "center",
  },
  badge: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors._green,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    color: colors.black,
  },
  connectionStringSection: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  connectionStringCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  connectionStringText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.grey2,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.black,
    textAlign: "center",
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
