import React from "react"
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  View,
  useWindowDimensions,
} from "react-native"
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler"
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
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
import { useI18nContext } from "@app/i18n/i18n-react"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { openExternalUrl } from "@app/utils/external"
import { toastShow } from "@app/utils/toast"
import { Skeleton, Text, makeStyles, useTheme } from "@rn-vui/themed"

const REFRESH_INTERVAL_MS = 60_000
const SCRIM_COLOR = "rgba(0, 0, 0, 0.4)"

// How much of the screen the sheet covers once fully open. Short of the whole
// thing on purpose: the pin stays visible, so it is still clear which place is
// being read about.
const SHEET_RATIO = 0.88

// Dragged this much further down than the snap point it started from, the sheet
// is being dismissed rather than resized.
const DISMISS_DISTANCE = 80

// Where a flick would end up, so a fast short drag still snaps the way it was
// thrown rather than the way it happens to have stopped.
const VELOCITY_PROJECTION = 0.15

const SPRING = { damping: 20, stiffness: 220, mass: 0.6 }
const CLOSE_DURATION_MS = 200

// The sheet's outer shape is a rounded path, so Android antialiases every edge
// of it — including the straight bottom one. The top and sides hide that under
// their 1px border; the bottom has no border to hide it under, and the half-lit
// pixel that is left reads as a hairline of scrim between the sheet and the
// screen. The sheet has no bottom edge worth showing anyway — it rests on the
// screen's — so it is drawn this much taller and pulled down by the same
// amount, which puts the seam off-screen without moving anything that is on it.
const BOTTOM_OVERHANG = 1

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
  const { height: windowHeight } = useWindowDimensions()

  const sheetHeight = Math.round(windowHeight * SHEET_RATIO)

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
    // Reopening always starts low again, however it was left last time.
    setExpanded(false)
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

  // Offset from the sheet's own top: 0 is fully open, `sheetHeight` is off the
  // bottom of the screen.
  const offset = useSharedValue(sheetHeight)
  const dragStart = useSharedValue(0)
  // The resting offset that leaves the header block showing, once it has been
  // measured. Until then the sheet stays off-screen rather than guessing.
  const peekOffset = useSharedValue(sheetHeight)
  // The peek's bottom edge within the sheet (y + height), not its bare height:
  // the border, padding, and handle above it sit inside the visible window too,
  // and counting only the height clipped their worth off the peek's last row.
  const [peekBottom, setPeekBottom] = React.useState(0)
  const [isExpanded, setExpanded] = React.useState(false)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  // Read straight off the scroll view, so the pan can tell a drag on a list
  // that is already at its top from one that is scrolling it back up.
  const scrollOffset = useScrollViewOffset(scrollRef)

  // Exactly the measured bottom edge. The home indicator is cleared by padding
  // inside the peek instead (see `peek` below), so the strip above it belongs to
  // the peek: resting any higher than this uncovers the top of the row behind
  // it, and a row sliced through its glyphs reads as a rendering fault.
  const restingOffset = peekBottom ? Math.max(0, sheetHeight - peekBottom) : sheetHeight

  React.useEffect(() => {
    peekOffset.value = restingOffset
  }, [restingOffset, peekOffset])

  React.useEffect(() => {
    if (!place) {
      offset.value = withTiming(sheetHeight, { duration: CLOSE_DURATION_MS })
      return
    }
    // Follow the measurement only while resting low. The header block grows
    // once the details land — a place that can only be paid through another app
    // gains a whole card — and a sheet the user has already pulled up must not
    // drop back down under them when that happens.
    if (peekBottom && !isExpanded) {
      offset.value = withSpring(restingOffset, SPRING)
    }
  }, [place, peekBottom, restingOffset, sheetHeight, isExpanded, offset])

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // Small movements belong to whatever is underneath — a tap on a link
        // should not have to be perfectly still.
        .activeOffsetY([-12, 12])
        // So a downward drag at the top of the list can collapse the sheet
        // instead of the scroll view swallowing it. The cast is a types-only
        // gap: gesture-handler declares a ref to a component *type* here, and
        // reads the instance the animated ref actually holds.
        .simultaneousWithExternalGesture(
          scrollRef as unknown as React.RefObject<React.ComponentType>,
        )
        .onBegin(() => {
          dragStart.value = offset.value
        })
        .onUpdate((event) => {
          // Fully open with the list scrolled down, a downward drag is the list
          // being scrolled back up, not the sheet being pulled shut.
          if (dragStart.value === 0 && scrollOffset.value > 0 && event.translationY > 0) {
            return
          }
          offset.value = Math.max(0, dragStart.value + event.translationY)
        })
        .onEnd((event) => {
          const projected = offset.value + event.velocityY * VELOCITY_PROJECTION

          if (projected > peekOffset.value + DISMISS_DISTANCE) {
            offset.value = withTiming(
              sheetHeight,
              { duration: CLOSE_DURATION_MS },
              (finished) => {
                if (finished) runOnJS(onClose)()
              },
            )
            return
          }

          const toFull = projected < peekOffset.value / 2
          offset.value = withSpring(toFull ? 0 : peekOffset.value, SPRING)
          runOnJS(setExpanded)(toFull)
        }),
    [dragStart, offset, peekOffset, scrollOffset, scrollRef, sheetHeight, onClose],
  )

  // Dependency arrays are passed explicitly rather than left to the Babel
  // plugin to infer, so these still work where it is not applied — the test
  // environment among them.
  const sheetStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: offset.value }] }),
    [offset],
  )

  const backdropStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        offset.value,
        [sheetHeight, peekOffset.value],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    }),
    [offset, peekOffset, sheetHeight],
  )

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
    <Modal
      visible={Boolean(place)}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root on Android — the one in
          app.tsx does not reach into a separate window. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.backdropPress}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={LL.common.close()}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sheet, { height: sheetHeight + BOTTOM_OVERHANG }, sheetStyle]}
            testID="place-sheet"
          >
            <View style={styles.handle} />

            {/* What the lower resting position shows. Its measured bottom edge
                sets the snap point, so this block decides where the sheet
                stops. */}
            <View
              testID="place-sheet-peek"
              style={styles.peek}
              onLayout={(event) =>
                setPeekBottom(
                  event.nativeEvent.layout.y + event.nativeEvent.layout.height,
                )
              }
            >
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
            </View>

            <Animated.ScrollView
              testID="place-sheet-scroll"
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              // Below full height the sheet itself takes the drag; a list that
              // cannot be seen has nothing to scroll.
              scrollEnabled={isExpanded}
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
                  renderRow("globe", hostOf(websiteUrl ?? ""), () =>
                    openUrl(websiteUrl ?? ""),
                  )}
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
            </Animated.ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

type StyleProps = { bottomInset: number }

const useStyles = makeStyles(({ colors }, { bottomInset }: StyleProps) => ({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // A scrim has to darken in both themes; the theme's backdrop tokens invert
    // and would brighten the map behind the sheet in dark mode.
    backgroundColor: SCRIM_COLOR,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.grey4,
    paddingTop: 8,
    // Cancels the extra height above, so only the seam moves off-screen.
    marginBottom: -BOTTOM_OVERHANG,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginBottom: 8,
  },
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
  scroll: {
    flex: 1,
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
