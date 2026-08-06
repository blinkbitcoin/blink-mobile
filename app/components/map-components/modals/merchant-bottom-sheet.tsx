import React from "react"
import { IMarker } from "@app/screens/map-screen/btc-map-interface"
import { usePlace } from "../map-hooks/use-place"
import { Platform, Linking, Pressable, Share, TouchableOpacity, View, Text } from "react-native"
import { GaloyIcon, icons } from "@app/components/atomic/galoy-icon"
import BottomSheet from "@app/components/map-components/modals/bottom-sheet.tsx"
import { makeStyles, useTheme, Skeleton } from "@rn-vui/themed"
type Props = {
  visible: boolean
  onClose: () => void
  onVerify: () => void
  selectedMarker: IMarker | null
}

export const MerchantBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  onVerify,
  selectedMarker,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { placeData, isLoading } = usePlace(selectedMarker?.id)
  const name = placeData?.name ?? selectedMarker?.name ?? "An unnamed place"

  const handleShare = (merchantId?: string) => {
    if (!merchantId) return
    Share.share({ message: `https://btcmap.org/merchant/${merchantId}` })
  }
  const handlePhone = (phone: string) => Linking.openURL(`tel:${phone}`)
  const handleWebsite = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`
    Linking.openURL(fullUrl)
  }
  const handleEmail = (email: string) => Linking.openURL(`mailto:${email}`)

  const handleNavigation = () => {
    if (!selectedMarker) return
    const { latitude, longitude } = selectedMarker.location
    const label = encodeURIComponent(name)
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    })
    if (url) Linking.openURL(url)
  }

  const renderRow = (icon: keyof typeof icons, text: string, onPress?: () => void) => {
    if (isLoading) {
      return (
        <View style={styles.row}>
          <Skeleton animation="wave" width={16} height={16} style={styles.skeletonIcon} />
          <Skeleton animation="wave" width={200} height={16} />
        </View>
      )
    }
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
        <GaloyIcon name={icon} size={16} color={styles.rowText.color} />
        <Text
          style={[styles.rowText, onPress ? styles.linkText : null]}
          numberOfLines={1}
        >
          {text}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      renderAbove={
        <Pressable onPress={handleNavigation} style={styles.navigationButton}>
          <Text style={styles.navigationText}>Navigation</Text>
          <GaloyIcon name="arrow-right-turn" size={16} color={colors.primary} />
        </Pressable>
      }
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} ellipsizeMode="tail" numberOfLines={1}>
            {name}
          </Text>
          <TouchableOpacity hitSlop={8} onPress={() => handleShare(placeData?.id)}>
            <GaloyIcon name="share" size={25} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          {renderRow("check-fuzzy-circle", "Verified on 00/00/0000", onVerify)}
          {placeData?.address && renderRow("pin", placeData.address)}
          {renderRow("clock", "Mo-Su 07:00-22:00")}
          {placeData?.phone &&
            renderRow("phone", placeData.phone, () => handlePhone(placeData.phone))}
          {placeData?.website &&
            renderRow("web", placeData.website, () => handleWebsite(placeData.website))}
          {renderRow("web", "d4rp4t@tutanota.com", () =>
            handleEmail("d4rp4t@tutanota.com"),
          )}
        </View>
      </View>
    </BottomSheet>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {},
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 20,
    color: colors.black,
  },
  infoContainer: {
    marginTop: 14,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  rowText: {
    fontSize: 14,
    color: colors.black,
    flex: 1,
  },
  linkText: {
    color: "#F7931A",
    textDecorationLine: "underline",
  },
  skeletonIcon: {
    borderRadius: 8,
  },
  navigationButton: {
    position: "absolute",
    right: 10,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
    maxHeight: 40,
  },
  navigationText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.black,
  },
}))
