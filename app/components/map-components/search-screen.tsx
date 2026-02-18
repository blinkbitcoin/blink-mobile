import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Pressable, TextInput, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import debounce from "lodash.debounce"
import axios from "axios"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { BTCMAP_V4_API_BASE } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

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

type Props = {
  onClose: () => void
  setCommunityId: (id: number) => void
  setSelectedMarker: (id: number) => void
  hasLocation?: boolean
}

const RECENT_SEARCHES = [
  { name: "Satoshi Burgers", distance: "recent" },
  { name: "Café BTC", distance: "recent" },
  { name: "Hodl Hotel", distance: "recent" },
]

const NEARBY_PLACEHOLDERS = [
  { name: "Satoshi Burgers", distance: "200 meters away" },
  { name: "Arts and Crafts", distance: "0.6 km away" },
  { name: "Lightning Café", distance: "1.2 km away" },
]

const SEARCH_DEBOUNCE_MS = 300

const SearchScreen: FC<Props> = ({
  onClose,
  setCommunityId,
  setSelectedMarker,
  hasLocation = false,
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

  const opacity = useSharedValue(0)

  const focusInput = useCallback(() => inputRef.current?.focus(), [])

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 }, () => runOnJS(focusInput)())
  }, [])

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
            `${BTCMAP_V4_API_BASE}/search?q=${query}`,
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
      if (item.type === "area") {
        setCommunityId(item.id)
      } else {
        setSelectedMarker(item.id)
      }
      handleClose()
    },
    [setCommunityId, setSelectedMarker, handleClose],
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

  const placeholders = hasLocation ? NEARBY_PLACEHOLDERS : RECENT_SEARCHES

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
      {/* Search input - full width */}
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

      {/* Status messages */}
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

      {/* Placeholder - nearby or recent */}
      {search.length === 0 && !isLoading && (
        <FlatList
          data={placeholders}
          keyExtractor={(_, i) => `placeholder-${i}`}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <GaloyIcon name="pin" size={18} color={colors.grey2} />
              <View style={styles.listItemText}>
                <Text style={styles.listItemName}>{item.name}</Text>
                <Text style={styles.listItemSubtitle}>{item.distance}</Text>
              </View>
            </View>
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
}))
