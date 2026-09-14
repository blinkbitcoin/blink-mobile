import React from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  BtcMapNamedPlace,
  LatLng,
  PlaceCategory,
  PlaceSearchResult,
  displayDistance,
  searchPlaces,
  useBtcMapPlaceSearch,
} from "@app/btcmap"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

// Long enough that a common word still reaches past the shop next door, short
// enough that the list stays scannable and the rows stay cheap to draw.
const MAX_RESULTS = 40

type Props = {
  isVisible: boolean
  /** The middle of what the user is looking at, i.e. the area to search. */
  center: LatLng
  /** Where the phone thinks it is, when it has been allowed to say. */
  userLocation?: LatLng
  viewportRadiusKm: number
  categories: ReadonlySet<PlaceCategory>
  onSelect: (place: BtcMapNamedPlace) => void
  onClose: () => void
  /**
   * Fired once the modal has actually finished dismissing — iOS only, which is
   * the one platform that needs to know: presenting another modal any earlier
   * is silently dropped there.
   */
  onDismiss?: () => void
}

/**
 * Search over the places around the current view.
 *
 * Which area is searched and how far away things are are two different
 * questions: the list covers what is on screen, but "200 meters away" is only
 * true of somewhere the user is actually standing, so the distances — and the
 * order they put the list in — are measured from the phone's own position.
 *
 * Without location permission there is no such position and no honest distance
 * to print, so a row falls back to the place's address. Under half of them carry
 * one; the rest are left as just a name, which is still the thing being searched
 * for. Ranking then has nothing better to go on than the middle of the map.
 */
export const PlaceSearchModal: React.FC<Props> = ({
  isVisible,
  center,
  userLocation,
  viewportRadiusKm,
  categories,
  onSelect,
  onClose,
  onDismiss,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ topInset: insets.top, bottomInset: insets.bottom })

  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<TextInput>(null)

  const { places, isLoading, hasError, retry } = useBtcMapPlaceSearch({
    center,
    viewportRadiusKm,
    enabled: isVisible,
  })

  // Closing leaves the last search on screen for the length of the dismiss
  // animation, so the reset waits for the next opening instead.
  React.useEffect(() => {
    if (isVisible) setQuery("")
  }, [isVisible])

  const results = React.useMemo(
    () =>
      searchPlaces({
        places,
        query,
        origin: userLocation ?? center,
        categories,
        limit: MAX_RESULTS,
      }),
    [places, query, userLocation, center, categories],
  )

  const distanceLabel = (km: number) => {
    const { unit, value } = displayDistance(km)
    const distance = value.toLocaleString(locale)
    return unit === "m"
      ? LL.MapScreen.metersAway({ distance })
      : LL.MapScreen.kilometersAway({ distance })
  }

  const renderResult = ({ item }: { item: PlaceSearchResult }) => {
    // A distance is only a distance from somewhere. Without the phone's own
    // position the number would be measured from the middle of the map, which
    // is not what "away" means to the person reading it.
    const subtitle = userLocation ? distanceLabel(item.distanceKm) : item.place.address

    return (
      <Pressable
        testID={`search-result-${item.place.id}`}
        style={styles.row}
        onPress={() => onSelect(item.place)}
        accessibilityRole="button"
      >
        <GaloyIcon name="map-pin" size={20} color={colors.grey1} />
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {item.place.name}
          </Text>
          {Boolean(subtitle) && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </Pressable>
    )
  }

  // Only ever one of these is worth showing, and an empty list under a spinner
  // reads as "nothing here" before the answer has arrived.
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.notice}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )
    }

    if (hasError) {
      return (
        <Pressable style={styles.notice} onPress={retry} accessibilityRole="button">
          <GaloyIcon name="warning" size={16} color={colors.error} />
          <Text style={styles.noticeText}>{LL.MapScreen.searchError()}</Text>
          <Text style={styles.retry}>{LL.common.tryAgain()}</Text>
        </Pressable>
      )
    }

    return (
      <View style={styles.notice}>
        <GaloyIcon name="info" size={16} color={colors.grey2} />
        <Text style={styles.noticeText}>{LL.MapScreen.nothingToShow()}</Text>
      </View>
    )
  }

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
      // The results and the keyboard need the whole screen, so this one is
      // opaque rather than a sheet over the map.
      transparent={false}
      // `autoFocus` is unreliable inside a Modal on Android — the field mounts
      // before the window it lives in is attached, and the keyboard never comes
      // up. Focusing once the window is actually on screen does work.
      onShow={() => inputRef.current?.focus()}
      onDismiss={onDismiss}
    >
      <View style={styles.screen}>
        <View style={styles.field}>
          <TextInput
            testID="place-search-input"
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={LL.common.search()}
            placeholderTextColor={colors.grey2}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={LL.common.search()}
          />
          {/* One control, because there is only ever one thing left to undo:
              whatever has been typed, and failing that the search itself. */}
          <Pressable
            testID="clear-place-search"
            onPress={() => (query ? setQuery("") : onClose())}
            accessibilityRole="button"
            accessibilityLabel={query ? LL.MapScreen.clearSearch() : LL.common.close()}
            hitSlop={12}
          >
            <GaloyIcon name="close" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.place.id)}
          renderItem={renderResult}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          // Dragging the list is a deliberate move away from typing.
          keyboardDismissMode="on-drag"
        />
      </View>
    </Modal>
  )
}

type StyleProps = { topInset: number; bottomInset: number }

const useStyles = makeStyles(({ colors }, { topInset, bottomInset }: StyleProps) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: topInset + 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    backgroundColor: colors.grey5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    // Android gives inputs their own vertical padding on top of the row's.
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: bottomInset + 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey5,
  },
  rowText: {
    flex: 1,
    rowGap: 2,
  },
  name: {
    fontSize: 16,
    color: colors.black,
  },
  subtitle: {
    fontSize: 13,
    color: colors.grey2,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  noticeText: {
    fontSize: 14,
    color: colors.grey1,
  },
  retry: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
}))
