import React, { FC, useState, useEffect, useMemo } from "react"
import { View, ScrollView, TouchableOpacity, Dimensions } from "react-native"
import { ListItem, makeStyles, SearchBar, Text } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import debounce from "lodash.debounce"
import axios from "axios"

import { BTCMAP_V4_API_BASE } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

const screenHeight = Dimensions.get("window").height

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

type SearchContentProps = {
  closeModal: () => void
  setCommunityId: (id: number) => void
  setSelectedMarker: (id: number) => void
}

const SEARCH_DEBOUNCE_MS = 300

export const SearchContent: FC<SearchContentProps> = ({
  closeModal,
  setCommunityId,
  setSelectedMarker,
}) => {
  const styles = useStyles()
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const { LL } = useI18nContext()

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

  const onSearchElementClick = (searchResult: SearchResult) => {
    if (searchResult.type === "area") {
      setCommunityId(searchResult.id)
      return
    }
    setSelectedMarker(searchResult.id)
  }

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

  const updateSearch = (text: string) => {
    setSearch(text)
  }

  const handleClose = () => {
    setSearch("")
    setSearchResponse(null)
    setError(null)
    closeModal()
  }

  const elements = useMemo(() => {
    if (!searchResponse?.results?.length) return null
    return searchResponse.results.map((e) => (
      <TouchableOpacity
        key={`${e.type}-${e.id}`}
        onPress={() => {
          closeModal()
          onSearchElementClick(e)
        }}
      >
        <ListItem containerStyle={styles.list}>
          <Icon name="location-outline" size={15} style={styles.listIcon} />
          <ListItem.Title>{e.name}</ListItem.Title>
        </ListItem>
      </TouchableOpacity>
    ))
  }, [searchResponse])

  return (
    <View style={styles.componentWrapper}>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal}>Search</Text>
        <Icon
          color="grey"
          name="close"
          size={22}
          style={styles.icon}
          onPress={handleClose}
        />
      </View>

      <SearchBar
        containerStyle={styles.searchContainer}
        round
        inputContainerStyle={styles.searchInputContainer}
        inputStyle={styles.searchInput}
        onChangeText={updateSearch}
        value={search}
        lightTheme
        placeholder={LL.MapScreen.search.placeholder()}
        placeholderTextColor="#888"
        searchIcon={<Icon color="grey" name="search" size={18} style={styles.icon} />}
        clearIcon={
          <Icon
            color="grey"
            name="close"
            size={18}
            style={styles.icon}
            onPress={() => updateSearch("")}
          />
        }
      />

      <ScrollView>
        {isLoading && (
          <Text style={styles.statusInfo}>{LL.MapScreen.search.loading()}</Text>
        )}

        {error && <Text style={styles.error}>{error.message}</Text>}

        {!isLoading && search && searchResponse?.results?.length === 0 && (
          <Text style={styles.statusInfo}>{LL.MapScreen.search.noResults()}</Text>
        )}

        {search.length > 0 && search.length < 3 && !isLoading && (
          <Text style={styles.statusInfo}>{LL.MapScreen.search.minChars()}</Text>
        )}

        {elements}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  componentWrapper: { minHeight: screenHeight - 300, maxHeight: screenHeight - 300 },
  searchContainer: { backgroundColor: "transparent", borderColor: "transparent" },
  searchInputContainer: { height: 40 },
  searchInput: { fontSize: 15 },
  titleContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  titleModal: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
  },
  list: {
    padding: 10,
    backgroundColor: "transparent",
  },
  listIcon: {
    color: colors.black,
  },
  icon: {
    paddingHorizontal: 1,
  },
  statusInfo: { textAlign: "center", marginVertical: 10 },
  error: { textAlign: "center", marginVertical: 10, color: "red" },
}))
