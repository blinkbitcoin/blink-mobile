import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Pressable, TextInput, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import debounce from "lodash.debounce"
import axios from "axios"

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
}

const SEARCH_DEBOUNCE_MS = 300

const SearchScreen: FC<Props> = ({ onClose, setCommunityId, setSelectedMarker }) => {
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
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (search.trim().length >= 3) {
      debouncedSearch(search)
    } else {
      setSearchResponse(null)
      setError(null)
    }
  }, [search, debouncedSearch])

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const onResultPress = useCallback(
    (item: SearchResult) => {
      if (item.type === "area") {
        setCommunityId(item.id)
      } else {
        setSelectedMarker(item.id)
      }
      onClose()
    },
    [setCommunityId, setSelectedMarker, onClose],
  )

  const clearSearch = useCallback(() => {
    setSearch("")
    setSearchResponse(null)
    setError(null)
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <Pressable onPress={() => onResultPress(item)} style={styles.listItem}>
        <GaloyIcon name="map" size={16} color={colors.grey2} />
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

  const ItemSeparator = useCallback(
    () => <View style={styles.divider} />,
    [styles.divider],
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <GaloyIcon name="magnifying-glass" size={16} color={colors.grey2} />
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
          {search.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <GaloyIcon name="close" size={16} color={colors.grey2} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
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

      <FlatList
        data={searchResponse?.results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />
    </View>
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
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 40,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.black,
    padding: 0,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  list: {
    marginTop: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 14,
    gap: 10,
  },
  listItemText: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    color: colors.black,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: colors.grey2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey4,
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
