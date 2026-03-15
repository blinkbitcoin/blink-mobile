import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Pressable, TextInput, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import debounce from "lodash.debounce"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { BTCMAP_V4_API_BASE } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

const RECENT_SEARCHES_KEY = "btcmap_recent_searches"
const MAX_RECENT = 5

type RecentSearch = { id: number; name: string; type: "area" | "element" }

const loadRecentSearches = async (): Promise<RecentSearch[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveRecentSearch = async (item: RecentSearch) => {
  const current = await loadRecentSearches()
  const filtered = current.filter((r) => !(r.id === item.id && r.type === item.type))
  const updated = [item, ...filtered].slice(0, MAX_RECENT)
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
}

type SearchResponse = {
  results: SearchResult[]
  totalCount: number
  has_more: boolean
  query: string
  pagination: PaginationInfo
}

type SearchResult = {
  name: string
  type: "area" | "element"
  id: number
}

type PaginationInfo = {
  offset: number
  limit: number
  total: number
}

type NearbyPlace = {
  id: number
  name: string
  lat: number
  lon: number
}

type Props = {
  onClose: () => void
  setSelectedMarker: (id: number) => void
  hasLocation?: boolean
  mapCenter: { latitude: number; longitude: number }
}

const SEARCH_DEBOUNCE_MS = 300
const NEARBY_RADIUS_KM = 50
const NEARBY_LIMIT = 3

const formatDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  if (d < 1) return `${Math.round(d * 1000)}m away`
  return `${d.toFixed(1)}km away`
}

const SearchScreen: FC<Props> = ({
  onClose,
  setSelectedMarker,
  hasLocation = false,
  mapCenter,
}) => {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const {
    theme: { colors },
  } = useTheme()
  const inputRef = useRef<TextInput>(null)
  const { LL } = useI18nContext()

  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  const opacity = useSharedValue(0)

  const focusInput = useCallback(() => inputRef.current?.focus(), [])

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 }, () => runOnJS(focusInput)())
    loadRecentSearches().then(setRecentSearches)
  }, [])

  // Fetch nearby places only when location permission is granted
  useEffect(() => {
    if (!hasLocation) return
    const fetchNearby = async () => {
      try {
        const { data } = await axios.get<NearbyPlace[]>(
          `${BTCMAP_V4_API_BASE}/places/search?lat=${mapCenter.latitude}&lon=${mapCenter.longitude}&radius_km=${NEARBY_RADIUS_KM}&limit=${NEARBY_LIMIT}&fields=id,name,lat,lon`,
        )
        setNearbyPlaces(data)
      } catch {
        // silent - nearby is best-effort
      }
    }
    fetchNearby()
  }, [hasLocation, mapCenter.latitude, mapCenter.longitude])

  const handleClose = useCallback(() => {
    inputRef.current?.blur()
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(onClose)()
    })
  }, [onClose])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        try {
          setIsLoading(true)
          const { data } = await axios.get<SearchResponse>(
            `${BTCMAP_V4_API_BASE}/search?q=${query}&type=element`,
          )
          setSearchResponse(data)
          setError(null)
        } catch (e) {
          setError(e as Error)
          setSearchResponse(null)
        } finally {
          setIsLoading(false)
        }
      }, SEARCH_DEBOUNCE_MS),
    [],
  )

  useEffect(() => {
    if (search.trim().length >= 3) {
      debouncedSearch(search)
    } else {
      setSearchResponse(null)
      setError(null)
    }
  }, [search, debouncedSearch])

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const onResultPress = useCallback(
    (item: SearchResult) => {
      saveRecentSearch({ id: item.id, name: item.name, type: item.type })
      setSelectedMarker(item.id)
      handleClose()
    },
    [setSelectedMarker, handleClose],
  )

  const clearOrClose = useCallback(() => {
    if (search.length > 0) {
      setSearch("")
      setSearchResponse(null)
      setError(null)
    } else {
      handleClose()
    }
  }, [search, handleClose])

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <Pressable onPress={() => onResultPress(item)} style={styles.listItem}>
        <GaloyIcon name="pin" size={18} color={colors.grey2} />
        <View style={styles.listItemText}>
          <Text style={styles.listItemName}>{item.name}</Text>
          <Text style={styles.listItemSubtitle}>
            {item.type === "area" ? "Community" : "Business"}
          </Text>
        </View>
      </Pressable>
    ),
    [onResultPress, colors.grey2, styles],
  )

  const keyExtractor = useCallback((item: SearchResult) => `${item.type}-${item.id}`, [])

  const ItemSeparator = useCallback(() => <View style={styles.divider} />, [styles.divider])

  const onNearbyPress = useCallback(
    (place: NearbyPlace) => {
      saveRecentSearch({ id: place.id, name: place.name ?? "Unnamed place", type: "element" })
      setSelectedMarker(place.id)
      handleClose()
    },
    [setSelectedMarker, handleClose],
  )

  const onRecentPress = useCallback(
    (item: RecentSearch) => {
      setSelectedMarker(item.id)
      handleClose()
    },
    [setSelectedMarker, handleClose],
  )

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder={LL.MapScreen.search.placeholder()}
          placeholderTextColor={colors.grey2}
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable onPress={clearOrClose} hitSlop={12}>
          <GaloyIcon name="close" size={16} color={colors.primary} />
        </Pressable>
      </View>

      {isLoading && (
        <Text style={styles.statusInfo}>{LL.MapScreen.search.loading()}</Text>
      )}
      {error && <Text style={styles.errorText}>{error.message}</Text>}
      {!isLoading && search.length > 0 && search.length < 3 && (
        <Text style={styles.statusInfo}>{LL.MapScreen.search.minChars()}</Text>
      )}
      {!isLoading && search.length >= 3 && searchResponse?.results?.length === 0 && (
        <Text style={styles.statusInfo}>{LL.MapScreen.search.noResults()}</Text>
      )}

      {/* Nearby places (only with location permission) */}
      {search.length === 0 && !isLoading && nearbyPlaces.length > 0 && (
        <FlatList
          data={nearbyPlaces}
          keyExtractor={(item) => `nearby-${item.id}`}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>Nearby</Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onNearbyPress(item)} style={styles.listItem}>
              <GaloyIcon name="pin" size={18} color={colors.grey2} />
              <View style={styles.listItemText}>
                <Text style={styles.listItemName}>{item.name ?? "Unnamed place"}</Text>
                <Text style={styles.listItemSubtitle}>
                  {formatDistance(
                    mapCenter.latitude,
                    mapCenter.longitude,
                    item.lat,
                    item.lon,
                  )}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Recent searches – shown when idle, as fallback when no nearby or below nearby */}
      {search.length === 0 && !isLoading && recentSearches.length > 0 && (
        <FlatList
          data={recentSearches}
          keyExtractor={(item) => `recent-${item.type}-${item.id}`}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>Recent searches</Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onRecentPress(item)} style={styles.listItem}>
              <GaloyIcon name="pin" size={18} color={colors.grey2} />
              <View style={styles.listItemText}>
                <Text style={styles.listItemName}>{item.name}</Text>
                <Text style={styles.listItemSubtitle}>
                  {item.type === "area" ? "Community" : "Business"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Search results */}
      {search.length >= 3 && (
        <FlatList
          data={searchResponse?.results}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
        />
      )}
    </Animated.View>
  )
}

export default SearchScreen

const useStyles = makeStyles(({ colors }) => ({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    zIndex: 200,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    marginHorizontal: 12,
    marginVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
    minHeight: 44,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    padding: 0,
  },
  list: {
    paddingHorizontal: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  listItemText: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    color: colors.black,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: colors.grey2,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey4,
    marginLeft: 46,
  },
  statusInfo: {
    textAlign: "center",
    marginVertical: 14,
    color: colors.grey2,
    fontSize: 14,
  },
  errorText: {
    textAlign: "center",
    marginVertical: 14,
    color: "red",
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey2,
    marginTop: 8,
    marginBottom: 4,
  },
}))
