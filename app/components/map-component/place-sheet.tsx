import React from "react"
import { Linking, Platform, Pressable, Share, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  BTCMAP_SITE_URL,
  BtcMapPlace,
  LatLng,
  OSM_COPYRIGHT_URL,
  OpeningState,
  VerificationState,
  directionsUrl,
  formatSurveyDate,
  hostOf,
  isBoosted,
  isWebUrl,
  mailtoUrl,
  merchantUrl,
  openingStateAt,
  sharesClockWith,
  socialUrl,
  telUrl,
  useBtcMapPlaceDetails,
  verificationStateAt,
  webUrl,
} from "@app/btcmap"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { BottomSheet } from "@app/components/bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { openExternalUrl } from "@app/utils/external"
import { toastShow } from "@app/utils/toast"
import { Skeleton, Text, makeStyles, useTheme } from "@rn-vui/themed"

const REFRESH_INTERVAL_MS = 60_000

// How much of the screen the sheet covers once fully open. Short of the whole
// thing on purpose: the pin stays visible, so it is still clear which place is
// being read about.
const SHEET_RATIO = 0.88

// Brand names, so they stay untranslated. They are also what the ODbL credit is
// split on below, to find the two spans that should be drawn as links.
//
// The sentence spells them out rather than taking them as parameters. Parameters
// would guarantee the split always finds them, but only in a locale that had
// caught up with them: every one of the 28 we ship carries the credit already,
// with both names verbatim, so parameterising the English source would drift
// from all 28 at once (see locale-parity.spec.ts) to buy a guarantee they do not
// need. If a future translation does translate a brand name, that name loses its
// link and stays plain text — the credit still reads, which is what ODbL asks.
const BTC_MAP = "BTC Map"
const OPEN_STREET_MAP = "OpenStreetMap"

const ATTRIBUTION_LINKS: Record<string, string> = {
  [BTC_MAP]: BTCMAP_SITE_URL,
  [OPEN_STREET_MAP]: OSM_COPYRIGHT_URL,
}

// Capturing, so `split` hands back the names it split on and the sentence can
// be reassembled with those two pieces drawn as links.
const ATTRIBUTION_PATTERN = new RegExp(`(${BTC_MAP}|${OPEN_STREET_MAP})`)

type Props = {
  place: BtcMapPlace | null
  userLocation?: LatLng
  onClose: () => void
}

/**
 * The place's details, on a sheet with two resting positions.
 *
 * It opens at the lower one, which is measured rather than guessed: whatever the
 * header block turns out to be — name, the Navigate button, how much the place
 * can be trusted, and where and when it is open — is exactly what shows, so the
 * one action most people want is under their thumb without reading anything.
 * Dragging up rests it at full height, where the contact detail lives.
 *
 * The scroll view only scrolls once the sheet is fully open. Below that the
 * whole sheet takes the drag, so a pull anywhere on it resizes rather than
 * scrolling a list that has nowhere to go.
 */
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

  // `||` rather than `??`: an empty-string `opening_hours` is a value and not a
  // blank, so `??` would stop there and never look at the boost behind it. The
  // snapshot's own boost counts too — it is the only one there is until the
  // details land.
  const isTimeSensitive = Boolean(
    details?.openingHours || details?.boostedUntil || shown?.boostedUntil,
  )

  const [now, setNow] = React.useState(() => new Date())

  // Opening the sheet re-reads the clock whatever is on it. `now` also dates the
  // verification badge, and this component mounts with the map rather than with
  // the sheet, so without this it would still hold the moment the map tab first
  // appeared — days ago, on a process that has been alive that long.
  React.useEffect(() => {
    if (!place) return
    setNow(new Date())
  }, [place])

  // Then keep re-reading it while the sheet is open, so a place that opens or
  // closes under the user stops saying otherwise, as btcmap.org's pill does.
  // Only the open/closed badge and the boost age, so a place with neither is
  // not worth a re-render a minute.
  React.useEffect(() => {
    if (!place || !isTimeSensitive) return undefined
    const timer = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [place, isTimeSensitive])

  const boosted = isBoosted(details?.boostedUntil ?? shown?.boostedUntil, now)
  const styles = useStyles({ bottomInset: insets.bottom })

  if (!shown) return null

  const name = details?.name

  const openingState = sharesClockWith(userLocation, shown)
    ? openingStateAt(details?.openingHours, now)
    : OpeningState.Unknown

  const verification = verificationStateAt(details?.verifiedAt, now)

  // Web destinations get the in-app browser the rest of the app uses, so a tap
  // on a merchant's site does not strand the user in Safari. tel:, geo:/maps:
  // and lightning: have to reach the OS instead — InAppBrowser cannot open them.
  const openUrl = (url: string) => {
    const open = isWebUrl(url) ? openExternalUrl(url) : Linking.openURL(url)
    open.catch(() => toastShow({ message: LL.MapScreen.cannotOpenLink(), LL }))
  }

  const navigate = () =>
    openUrl(directionsUrl(shown, name, Platform.OS === "ios" ? "ios" : "android"))

  const share = () => {
    // A dismissed share sheet resolves; a rejection is the OS refusing, which
    // the user cannot act on and a toast would only interrupt.
    Share.share({ message: merchantUrl(details, shown.id) }).catch((error) =>
      recordAppError(toError(error), { expected: true, dedupKey: "btcmap-share" }),
    )
  }

  // Every link below started life as a raw OpenStreetMap tag, so it is checked
  // before it is offered — see the allowlists in `urls.ts`. A row whose value
  // does not survive that check is not drawn at all, rather than drawn as a tap
  // that goes somewhere other than what its icon and label promise.
  const websiteUrl = details?.website ? webUrl(details.website) : undefined
  const appUrl = details?.requiredAppUrl ? webUrl(details.requiredAppUrl) : undefined
  const phoneUrl = details?.phone ? telUrl(details.phone) : undefined
  const emailUrl = details?.email ? mailtoUrl(details.email) : undefined

  const renderRow = (icon: IconNamesType, text: string, onPress?: () => void) => (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : "text"}
    >
      <GaloyIcon name={icon} size={16} color={onPress ? colors.primary : colors.grey1} />
      <Text style={onPress ? styles.rowLink : styles.rowText}>{text}</Text>
    </Pressable>
  )

  // Brand names, so they stay untranslated — the same three btcmap.org lists.
  const socials = (
    [
      ["Instagram", "instagram.com", details?.instagram],
      ["Facebook", "facebook.com", details?.facebook],
      ["X", "x.com", details?.twitter],
    ] as [string, string, string | undefined][]
  ).flatMap(([label, host, value]) => {
    const url = value ? socialUrl(host, value) : undefined
    return url ? [[label, url] as [string, string]] : []
  })

  // Split apart so each brand name can be drawn as a link wherever the
  // translation happens to place it — the word order around them differs by
  // locale, and only the names themselves are fixed.
  const attribution = LL.MapScreen.attribution().split(ATTRIBUTION_PATTERN)

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
    <BottomSheet
      testID="place-sheet"
      headerTestID="place-sheet-peek"
      scrollTestID="place-sheet-scroll"
      isVisible={Boolean(place)}
      onClose={onClose}
      heightRatio={SHEET_RATIO}
      restsOnHeader
      headerStyle={styles.peek}
      contentContainerStyle={styles.scrollContent}
      /* What the lower resting position shows. Its measured bottom edge sets
         the snap point, so this block decides where the sheet stops. */
      header={
        <>
          <View style={styles.header}>
            {isLoading && !details ? (
              <Skeleton animation="pulse" style={styles.nameSkeleton} />
            ) : (
              <Text style={styles.name} numberOfLines={2}>
                {name || LL.MapScreen.unnamedPlace()}
              </Text>
            )}

            <Pressable
              testID="share-place"
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel={LL.common.share()}
              hitSlop={12}
            >
              <GaloyIcon name="share" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <GaloyPrimaryButton title={LL.MapScreen.navigate()} onPress={navigate} />

          {/* Sits with the header rather than down among the contact rows:
                  "you cannot pay here with this wallet" is worth knowing before
                  setting off, so it has to be visible without expanding. */}
          {Boolean(appUrl) && (
            <View testID="requires-app-card">
              <GaloyInfo>
                {LL.MapScreen.requiresApp()}
                {"\n"}
                {/* The scheme is noise here — what is worth reading is
                        where it goes, path and all. */}
                <Text
                  type="p3"
                  style={styles.requiresAppLink}
                  onPress={() => openUrl(appUrl ?? "")}
                  accessibilityRole="link"
                >
                  {(appUrl ?? "").replace(/^https?:\/\//i, "")}
                </Text>
              </GaloyInfo>
            </View>
          )}

          <View style={styles.status}>
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
            {Boolean(details) && (
              <View style={styles.verification}>
                <GaloyIcon
                  name={
                    verification === VerificationState.Verified
                      ? "check-circle"
                      : "warning"
                  }
                  size={14}
                  color={
                    verification === VerificationState.Verified
                      ? colors._green
                      : colors.grey2
                  }
                />
                <Text style={styles.verificationText}>{verificationLabel}</Text>
              </View>
            )}
          </View>

          {/* Where the place is and when it is open, under the status row as
                  the design has them: both are read on the way to deciding
                  whether to set off, so neither is worth a drag to reach. */}
          {Boolean(details?.address) && (
            <Text style={styles.peekFact}>{details?.address}</Text>
          )}
          {Boolean(details?.openingHours) && (
            <Text style={styles.peekFact}>{details?.openingHours}</Text>
          )}
        </>
      }
    >
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
        {/* The number and address are worth reading even when they are
                    not in a shape we are willing to hand to the dialer or mail
                    app, so these two rows stay — they just stop being tappable. */}
        {Boolean(details?.phone) &&
          renderRow(
            "phone",
            details?.phone ?? "",
            phoneUrl ? () => openUrl(phoneUrl) : undefined,
          )}
        {Boolean(websiteUrl) &&
          renderRow("globe", hostOf(websiteUrl ?? ""), () => openUrl(websiteUrl ?? ""))}
        {Boolean(details?.email) &&
          renderRow(
            "email-add",
            details?.email ?? "",
            emailUrl ? () => openUrl(emailUrl) : undefined,
          )}
        {Boolean(details?.paymentUrl) &&
          renderRow("lightning", LL.MapScreen.payMerchant(), () =>
            openUrl(details?.paymentUrl ?? ""),
          )}
        {/* No brand glyphs in the icon set, so they share one. */}
        {socials.map(([label, url]) => (
          <React.Fragment key={label}>
            {renderRow("link", label, () => openUrl(url))}
          </React.Fragment>
        ))}
      </View>

      {Boolean(details?.description) && (
        <Text style={styles.description}>{details?.description}</Text>
      )}

      {/* Dragging the sheet down closes it, but that is a gesture you
                  have to know about. This is the same thing, spelled out, and
                  it is the last thing you reach going down the detail. */}
      <GaloySecondaryButton
        testID="close-place-sheet"
        title={LL.common.close()}
        onPress={onClose}
        containerStyle={styles.close}
      />

      {/* The places are OpenStreetMap data under ODbL, which asks that
                  anyone looking at it can see where it came from and reach the
                  licence. It reads as a footnote here rather than as a chip on
                  the map, where a large system font size grew it until it
                  covered the streets it was crediting. */}
      <Text testID="place-sheet-attribution" style={styles.attribution}>
        {attribution.map((part, index) => {
          const url = ATTRIBUTION_LINKS[part]
          return url ? (
            <Text
              key={`${part}-${index}`}
              style={styles.attributionLink}
              onPress={() => openUrl(url)}
              accessibilityRole="link"
            >
              {part}
            </Text>
          ) : (
            part
          )
        })}
      </Text>
    </BottomSheet>
  )
}

type StyleProps = { bottomInset: number }

const useStyles = makeStyles(({ colors }, { bottomInset }: StyleProps) => ({
  peek: {
    paddingHorizontal: 20,
    rowGap: 14,
    // The sheet's foot sits at the screen edge while resting, so the home
    // indicator is cleared here rather than by resting higher than the peek —
    // lifting the snap point instead only uncovers the row behind it.
    paddingBottom: 14 + bottomInset,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  name: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.black,
  },
  nameSkeleton: {
    flex: 1,
    height: 22,
    borderRadius: 4,
  },
  requiresAppLink: {
    // Restated rather than inherited: the themed Text falls back to black, not
    // to the surrounding GaloyInfo tint.
    color: colors.blue5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 6,
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
  verification: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    flexShrink: 1,
  },
  verificationText: {
    fontSize: 12,
    color: colors.grey1,
    flexShrink: 1,
  },
  peekFact: {
    fontSize: 14,
    color: colors.grey1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: bottomInset + 24,
    rowGap: 16,
    // So a place with little to say still puts Close at the foot of the sheet
    // rather than leaving it stranded halfway up under a short list.
    flexGrow: 1,
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
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
  description: {
    fontSize: 14,
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
  close: {
    // Pushed to the foot of the scroll area by whatever space is left over.
    marginTop: "auto",
  },
  attribution: {
    fontSize: 12,
    color: colors.grey2,
    textAlign: "center",
  },
  attributionLink: {
    // Same grey as the sentence around it: this is a credit, not an action, so
    // the underline is the only thing marking the two names as reachable.
    color: colors.grey2,
    textDecorationLine: "underline",
  },
}))
