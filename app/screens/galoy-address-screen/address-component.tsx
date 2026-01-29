import { Linking, Pressable, Share, View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

const addressTypes = {
  lightning: "lightning",
  pos: "pos",
  paycode: "paycode",
} as const

type AddressComponentprops = {
  address: string
  addressType: (typeof addressTypes)[keyof typeof addressTypes]
  title: string
  useGlobeIcon?: boolean
  onToggleDescription?: () => void
}

const AddressComponent: React.FC<AddressComponentprops> = ({
  address,
  addressType,
  title,
  onToggleDescription,
  useGlobeIcon,
}) => {
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const trimmedUrl =
    address.includes("https://") || address.includes("http://")
      ? address.replace("https://", "")
      : address

  const getClipboardMessage = () => {
    switch (addressType) {
      case addressTypes.lightning:
        return LL.GaloyAddressScreen.copiedLightningAddressToClipboard()
      case addressTypes.pos:
        return LL.GaloyAddressScreen.copiedCashRegisterLinkToClipboard()
      case addressTypes.paycode:
        return LL.GaloyAddressScreen.copiedPaycodeToClipboard()
    }
  }

  const handleCopyToClipboard = () => {
    copyToClipboard({
      content: address,
      message: getClipboardMessage(),
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.addressTitle} type="p1">
          {title}
        </Text>
        <Pressable onPress={onToggleDescription} style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{LL.GaloyAddressScreen.howToUseIt()}</Text>
          <GaloyIcon name="question" color={styles.descriptionText.color} size={20} />
        </Pressable>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.address} bold type="p3">
          {trimmedUrl}
        </Text>
        <View style={styles.iconsContainer}>
          {useGlobeIcon && (
            <Pressable onPress={() => Linking.openURL(address)}>
              <GaloyIcon name="globe" size={20} color={colors.black} />
            </Pressable>
          )}
          <Pressable onPress={handleCopyToClipboard}>
            <GaloyIcon name="copy-paste" size={20} color={colors.black} />
          </Pressable>
          <Pressable
            onPress={() => {
              Share.share({
                url: address,
                message: address,
              })
            }}
          >
            <GaloyIcon name="share" size={20} color={colors.black} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default AddressComponent

const useStyles = makeStyles(({ colors }) => ({
  container: {
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
    width: "100%",
  },
  titleContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  addressTitle: {
    fontSize: 16,
    lineHeight: 24,
    flexShrink: 1,
  },
  infoContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    backgroundColor: colors.grey5,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 20,
  },
  address: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 24,
  },
  descriptionContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 5,
  },
  descriptionText: {
    color: colors.primary,
    textDecorationLine: "underline",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  iconsContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 20,
  },
}))
