import React from "react"
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import {
  BTCMAP_SITE_URL,
  BtcMapPlace,
  BtcMapPlaceDetails,
  LatLng,
  OpeningState,
  VerificationState,
  formatSurveyDate,
  isBoosted,
  materialIconName,
  openingStateAt,
  sharesClockWith,
  useBtcMapPlaceDetails,
  verificationStateAt,
} from "@app/btcmap"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"
import { Skeleton, Text, makeStyles, useTheme } from "@rn-vui/themed"

import { PIN_COLOR, PIN_COLOR_BOOSTED } from "./pin-shape"

const REFRESH_INTERVAL_MS = 60_000
const SCRIM_COLOR = "rgba(0, 0, 0, 0.4)"

type Props = {
  place: BtcMapPlace | null
  userLocation?: LatLng
  onClose: () => void
}

const merchantUrl = (details: BtcMapPlaceDetails | null, place: BtcMapPlace) =>
  `${BTCMAP_SITE_URL}/merchant/${details?.osmId ?? place.id}`

/** btcmap.org shows the bare host, which is all anyone reads off a link anyway. */
const hostOf = (url: string) =>
  url
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]

const withScheme = (url: string) => (/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`)

/**
 * OSM stores `contact:instagram` and friends as either a full URL or a bare
 * handle, and roughly half of BTC Map's are handles. Prefixing a handle with
 * `https://` yields `https://@someone`, which resolves to nothing — so a value
 * without a host is treated as a username on the platform's own domain.
 */
const socialUrl = (host: string, value: string) => {
  const trimmed = value.trim()
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed
  if (trimmed.includes(".")) return `https://${trimmed}`
  return `https://${host}/${trimmed.replace(/^@/, "")}`
}

export const PlaceSheet: React.FC<Props> = ({ place, userLocation, onClose }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const insets = useSafeAreaInsets()

  // Hold on to what was last opened so the sheet still has something to draw
  // while it slides back out; `place` goes null the moment it is dismissed.
  const shownRef = React.useRef<BtcMapPlace | null>(null)
  if (place) shownRef.current = place
  const shown = shownRef.current

  const { details, isLoading, hasError, retry } = useBtcMapPlaceDetails(shown?.id)

  // Re-read the clock while the sheet is open so a place that opens or closes
  // under the user stops saying otherwise, as btcmap.org's pill does.
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    if (!place) return undefined
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [place])

  const boosted = isBoosted(details?.boostedUntil ?? shown?.boostedUntil, now)
  const styles = useStyles({
    bottomInset: insets.bottom,
    accent: boosted ? PIN_COLOR_BOOSTED : PIN_COLOR,
  })

  if (!shown) return null

  const name = details?.name

  const openingState = sharesClockWith(userLocation, shown)
    ? openingStateAt(details?.openingHours, now)
    : OpeningState.Unknown

  const verification = verificationStateAt(details?.verifiedAt, now)

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() =>
      toastShow({ message: LL.MapScreen.cannotOpenLink(), LL }),
    )
  }

  const navigate = () => {
    const { latitude, longitude } = shown
    // Without a name there is nothing to label the pin with, and an empty label
    // turns both platforms' URLs into a text search that finds nothing — so the
    // bare-coordinate form is used instead.
    const label = name ? encodeURIComponent(name) : ""
    const url = Platform.select({
      ios: label
        ? `maps:0,0?q=${label}@${latitude},${longitude}`
        : `maps:0,0?ll=${latitude},${longitude}`,
      android: label
        ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
    })
    if (url) openUrl(url)
  }

  const share = () => {
    Share.share({ message: merchantUrl(details, shown) })
  }

  const renderRow = (icon: IconNamesType, text: string, onPress?: () => void) => (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : "text"}
    >
      <GaloyIcon name={icon} size={16} color={colors.grey1} />
      <Text style={onPress ? styles.rowLink : styles.rowText}>{text}</Text>
    </Pressable>
  )

  const renderAction = (icon: IconNamesType, label: string, onPress: () => void) => (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button">
      <View style={styles.actionIcon}>
        <GaloyIcon name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  )

  const renderChip = (label: string, url: string) => (
    <Pressable key={label} style={styles.chip} onPress={() => openUrl(url)}>
      <Text style={styles.chipText}>{label}</Text>
      <GaloyIcon name="arrow-square-out" size={12} color={colors.primary} />
    </Pressable>
  )

  const acceptsLabels = [
    details?.acceptsLightning ? LL.common.lightning() : "",
    details?.acceptsOnchain ? LL.common.onchain() : "",
    details?.acceptsContactless ? LL.MapScreen.contactless() : "",
  ].filter(Boolean)

  // Brand names, so they stay untranslated — the same three btcmap.org lists.
  const socials: [string, string][] = (
    [
      ["Instagram", "instagram.com", details?.instagram],
      ["Facebook", "facebook.com", details?.facebook],
      ["X", "x.com", details?.twitter],
    ] as [string, string, string | undefined][]
  )
    .filter(([, , value]) => Boolean(value))
    .map(([label, host, value]) => [label, socialUrl(host, value as string)])

  const verificationLabel = {
    [VerificationState.Verified]: () =>
      LL.MapScreen.verifiedOn({
        date: formatSurveyDate(details?.verifiedAt ?? "", locale),
      }),
    [VerificationState.Outdated]: () =>
      LL.MapScreen.lastVerifiedOn({
        date: formatSurveyDate(details?.verifiedAt ?? "", locale),
      }),
    [VerificationState.Unsurveyed]: () => LL.MapScreen.needsSurvey(),
  }[verification]()

  return (
    <Modal
      visible={Boolean(place)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={LL.common.close()}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <MaterialIcon
                name={materialIconName(shown.icon)}
                size={24}
                color={colors._white}
              />
            </View>

            <View style={styles.headerText}>
              {isLoading && !details ? (
                <Skeleton animation="pulse" style={styles.nameSkeleton} />
              ) : (
                <Text style={styles.name} numberOfLines={2}>
                  {name || LL.MapScreen.unnamedPlace()}
                </Text>
              )}

              {Boolean(details?.address) && (
                <Text style={styles.address} numberOfLines={2}>
                  {details?.address}
                </Text>
              )}

              <View style={styles.badges}>
                {openingState !== OpeningState.Unknown && (
                  <View style={styles.badge}>
                    <Text
                      style={
                        openingState === OpeningState.Open
                          ? styles.badgeOpen
                          : styles.badgeClosed
                      }
                    >
                      {openingState === OpeningState.Open
                        ? LL.MapScreen.openNow()
                        : LL.MapScreen.closedNow()}
                    </Text>
                  </View>
                )}
                {boosted && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeBoosted}>{LL.MapScreen.boosted()}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {hasError && (
            <Pressable style={styles.errorRow} onPress={retry}>
              <GaloyIcon name="warning" size={16} color={colors.error} />
              <Text style={styles.errorText}>{LL.MapScreen.detailsError()}</Text>
              <Text style={styles.retryText}>{LL.common.tryAgain()}</Text>
            </Pressable>
          )}

          {isLoading && !details && (
            <View style={styles.skeletonBlock}>
              <Skeleton animation="pulse" style={styles.skeletonRow} />
              <Skeleton animation="pulse" style={styles.skeletonRow} />
              <Skeleton animation="pulse" style={styles.skeletonRow} />
            </View>
          )}

          <View style={styles.rows}>
            {Boolean(details?.openingHours) &&
              renderRow("clock", details?.openingHours ?? "")}
            {Boolean(details?.phone) &&
              renderRow("phone", details?.phone ?? "", () =>
                openUrl(`tel:${details?.phone}`),
              )}
            {Boolean(details?.website) &&
              renderRow("globe", hostOf(details?.website ?? ""), () =>
                openUrl(withScheme(details?.website ?? "")),
              )}
            {Boolean(details?.email) &&
              renderRow("email-add", details?.email ?? "", () =>
                openUrl(`mailto:${details?.email}`),
              )}
            {Boolean(details?.paymentUrl) &&
              renderRow("lightning", LL.MapScreen.payMerchant(), () =>
                openUrl(details?.paymentUrl ?? ""),
              )}
            {Boolean(details?.requiredAppUrl) &&
              renderRow("info", LL.MapScreen.requiresApp(), () =>
                openUrl(withScheme(details?.requiredAppUrl ?? "")),
              )}
          </View>

          {acceptsLabels.length > 0 && (
            <View style={styles.accepts}>
              <Text style={styles.sectionLabel}>{LL.MapScreen.accepts()}</Text>
              <View style={styles.chips}>
                {acceptsLabels.map((label) => (
                  <View key={label} style={styles.acceptsPill}>
                    <GaloyIcon name="bitcoin" size={12} color={colors.primary} />
                    <Text style={styles.acceptsPillText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Boolean(details) && (
            <View style={styles.row}>
              <GaloyIcon
                name={
                  verification === VerificationState.Verified ? "check-circle" : "warning"
                }
                size={16}
                color={
                  verification === VerificationState.Verified
                    ? colors._green
                    : colors.grey2
                }
              />
              <Text style={styles.rowText}>{verificationLabel}</Text>
            </View>
          )}

          {Boolean(details?.description) && (
            <Text style={styles.description}>{details?.description}</Text>
          )}

          <View style={styles.actions}>
            {renderAction("map", LL.MapScreen.navigate(), navigate)}
            {Boolean(details?.phone) &&
              renderAction("phone", LL.common.phone(), () =>
                openUrl(`tel:${details?.phone}`),
              )}
            {renderAction("share", LL.common.share(), share)}
          </View>

          {socials.length > 0 && (
            <View style={styles.chips}>
              {socials.map(([label, url]) => renderChip(label, url))}
            </View>
          )}

          <Pressable
            style={styles.profileLink}
            onPress={() => openUrl(merchantUrl(details, shown))}
          >
            <Text style={styles.profileLinkText}>{LL.MapScreen.seeOnBtcMap()}</Text>
            <GaloyIcon name="arrow-square-out" size={14} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}

type StyleProps = { bottomInset: number; accent: string }

const useStyles = makeStyles(({ colors }, { bottomInset, accent }: StyleProps) => ({
  backdrop: {
    flex: 1,
    // A scrim has to darken in both themes; the theme's backdrop tokens invert
    // and would brighten the map behind the sheet in dark mode.
    backgroundColor: SCRIM_COLOR,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.grey4,
    paddingTop: 8,
    paddingBottom: bottomInset + 16,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginBottom: 8,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    rowGap: 16,
  },
  header: {
    flexDirection: "row",
    columnGap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accent,
  },
  headerText: {
    flex: 1,
    rowGap: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.black,
  },
  nameSkeleton: {
    height: 22,
    width: "70%",
    borderRadius: 4,
  },
  address: {
    fontSize: 14,
    color: colors.grey1,
  },
  badges: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.grey5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOpen: {
    fontSize: 12,
    fontWeight: "600",
    color: colors._green,
  },
  badgeClosed: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
  },
  badgeBoosted: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  rows: {
    rowGap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    // Tappable rows sit next to each other, so each needs a hit area big enough
    // that reaching for the website does not dial the phone.
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: colors.black,
  },
  rowLink: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.grey2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accepts: {
    rowGap: 8,
  },
  acceptsPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  acceptsPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.black,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderWidth: 1,
    borderColor: colors.grey4,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  chipText: {
    fontSize: 12,
    color: colors.black,
  },
  description: {
    fontSize: 14,
    color: colors.grey1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.grey4,
    paddingVertical: 12,
  },
  action: {
    alignItems: "center",
    rowGap: 4,
    minWidth: 64,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    color: colors.grey1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    minHeight: 44,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  skeletonBlock: {
    rowGap: 10,
  },
  skeletonRow: {
    height: 14,
    borderRadius: 4,
  },
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    minHeight: 44,
  },
  profileLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
}))
