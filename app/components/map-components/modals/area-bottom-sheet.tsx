import React from "react"
import { Linking, Pressable, Share, TouchableOpacity, View, Text } from "react-native"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import BottomSheet from "@app/components/map-components/modals/bottom-sheet.tsx"
import { makeStyles, useTheme, Skeleton } from "@rn-vui/themed"
import { Area } from "@app/components/map-components/map-types"

type Props = {
  visible: boolean
  onClose: () => void
  community: Area | null
  isLoading: boolean
}

export const AreaBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  community,
  isLoading,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const tags = community?.tags ?? {}
  const name = (tags.name as string) ?? "Unknown community"
  const website = tags.url_website as string | undefined
  const twitter = tags.url_twitter as string | undefined
  const telegram = tags.url_telegram as string | undefined
  const population = tags.population as number | undefined
  const areaType = tags.type as string | undefined

  const handleShare = () => {
    if (!community) return
    Share.share({ message: `https://btcmap.org/community/${community.id}` })
  }

  const handleLink = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`
    Linking.openURL(fullUrl)
  }

  const renderRow = (
    icon: React.ComponentProps<typeof GaloyIcon>["name"],
    text: string,
    onPress?: () => void,
  ) => {
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
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} ellipsizeMode="tail" numberOfLines={1}>
            {name}
          </Text>
          <TouchableOpacity hitSlop={8} onPress={handleShare}>
            <GaloyIcon name="share" size={25} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          {areaType && renderRow("pin", areaType.charAt(0).toUpperCase() + areaType.slice(1))}
          {population && renderRow("people-2", `Population: ${population.toLocaleString()}`)}
          {website && renderRow("web", website, () => handleLink(website))}
          {twitter && renderRow("web", twitter, () => handleLink(twitter))}
          {telegram && renderRow("web", telegram, () => handleLink(telegram))}
        </View>

        <Pressable style={styles.clearButton} onPress={onClose}>
          <Text style={styles.clearButtonText}>Clear selection</Text>
        </Pressable>
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
  clearButton: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.grey5,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.grey2,
  },
}))
