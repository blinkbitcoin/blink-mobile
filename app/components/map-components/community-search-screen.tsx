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

const RECENT_SEARCHES_KEY = "btcmap_recent_searches"
const MAX_RECENT = 5

type RecentCommunity = { id: number; name: string; businessCount: number }

const loadRecentCommunities = async (): Promise<RecentCommunity[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY)
    const all: Array<{ id: number; name: string; type: string; businessCount?: number }> = raw
      ? JSON.parse(raw)
      : []
    return all
      .filter((r) => r.type === "area")
      .map((r) => ({ id: r.id, name: r.name, businessCount: r.businessCount ?? 0 }))
  } catch {
    return []
  }
}

const saveRecentCommunity = async (item: RecentCommunity) => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY)
    const all: Array<{ id: number; name: string; type: string; businessCount?: number }> = raw
      ? JSON.parse(raw)
      : []
    const filtered = all.filter((r) => !(r.id === item.id && r.type === "area"))
    const updated = [{ ...item, type: "area" }, ...filtered].slice(0, MAX_RECENT)
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // silent
  }
}

type CommunityResult = {
  id: number
  name: string
  businessCount: number
}

type Props = {
  onClose: () => void
  setCommunityId: (id: number) => void
}

const PLACEHOLDER_COMMUNITIES: CommunityResult[] = [
  { id: 0, name: "Bitcoin Berlín", businessCount: 178 },
  { id: 0, name: "Bitcoin Beach", businessCount: 98 },
  { id: 0, name: "Bitcoin Santa Ana", businessCount: 50 },
  { id: 0, name: "Bitcoin Coast", businessCount: 120 },
  { id: 0, name: "Bitcoin Pirraya", businessCount: 21 },
]

const SEARCH_DEBOUNCE_MS = 300

const CommunitySearchScreen: FC<Props> = ({ onClose, setCommunityId }) => {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const {
    theme: { colors },
  } = useTheme()
  const inputRef = useRef<TextInput>(null)

  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<CommunityResult[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [recentCommunities, setRecentCommunities] = useState<RecentCommunity[]>([])

  const opacity = useSharedValue(0)

  const focusInput = useCallback(() => inputRef.current?.focus(), [])

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 }, () => runOnJS(focusInput)())
    loadRecentCommunities().then(setRecentCommunities)
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
          const { data } = await axios.get(
            `${BTCMAP_V4_API_BASE}/search?q=${query}&type=area`,
          )
          setResults(data.results ?? [])
          setError(null)
        } catch (e) {
          setError(e as Error)
          setResults(null)
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
      setResults(null)
      setError(null)
    }
  }, [search, debouncedSearch])

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const onResultPress = useCallback(
    (item: CommunityResult) => {
      saveRecentCommunity({ id: item.id, name: item.name, businessCount: item.businessCount })
      setCommunityId(item.id)
      handleClose()
    },
    [setCommunityId, handleClose],
  )

  const onRecentPress = useCallback(
    (item: RecentCommunity) => {
      setCommunityId(item.id)
      handleClose()
    },
    [setCommunityId, handleClose],
  )

  const clearOrClose = useCallback(() => {
    if (search.length > 0) {
      setSearch("")
      setResults(null)
      setError(null)
    } else {
      handleClose()
    }
  }, [search, handleClose])

  const ItemSeparator = useCallback(() => <View style={styles.divider} />, [styles.divider])

  const idleData: CommunityResult[] =
    recentCommunities.length > 0
      ? recentCommunities
      : PLACEHOLDER_COMMUNITIES
  const displayData = search.length >= 3 ? (results ?? []) : idleData
  const idleLabel = recentCommunities.length > 0 ? "Recent communities" : "Popular communities"

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search communities..."
          placeholderTextColor={colors.grey2}
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable onPress={clearOrClose} hitSlop={12}>
          <GaloyIcon name="close" size={16} color={colors.primary} />
        </Pressable>
      </View>

      {isLoading && <Text style={styles.statusInfo}>Searching...</Text>}
      {error && <Text style={styles.errorText}>{error.message}</Text>}
      {!isLoading && search.length > 0 && search.length < 3 && (
        <Text style={styles.statusInfo}>Type at least 3 characters</Text>
      )}
      {!isLoading && search.length >= 3 && results?.length === 0 && (
        <Text style={styles.statusInfo}>No communities found</Text>
      )}

      <FlatList
        data={displayData}
        keyExtractor={(item, i) => `community-${item.id}-${i}`}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        ListHeaderComponent={
          search.length < 3 ? <Text style={styles.sectionHeader}>{idleLabel}</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.listItem}
            onPress={() => onResultPress(item)}
            disabled={item.id === 0}
          >
            <GaloyIcon name="pin" size={18} color={colors.grey2} />
            <View style={styles.listItemText}>
              <Text style={styles.listItemName}>{item.name}</Text>
              <Text style={styles.listItemSubtitle}>{item.businessCount} businesses</Text>
            </View>
          </Pressable>
        )}
      />
    </Animated.View>
  )
}

export default CommunitySearchScreen

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
