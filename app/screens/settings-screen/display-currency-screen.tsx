import * as React from "react"
import { useCallback } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"
import { gql } from "@apollo/client"
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select"
import { Currency, useCurrencyListQuery } from "@app/graphql/generated"
import { useEffectiveDisplayCurrency } from "@app/hooks/use-effective-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, SearchBar, Text } from "@rn-vui/themed"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "../../components/screen"

gql`
  mutation accountUpdateDisplayCurrency($input: AccountUpdateDisplayCurrencyInput!) {
    accountUpdateDisplayCurrency(input: $input) {
      errors {
        message
      }
      account {
        id
        displayCurrency
      }
    }
  }
`

export const DisplayCurrencyScreen: React.FC = () => {
  const styles = useStyles()

  const { LL } = useI18nContext()

  const { displayCurrency, setDisplayCurrency } = useEffectiveDisplayCurrency()

  const { data, loading } = useCurrencyListQuery({
    fetchPolicy: "cache-and-network",
  })

  const [newCurrency, setNewCurrency] = React.useState("")
  const [searchText, setSearchText] = React.useState("")
  const [matchingCurrencies, setMatchingCurrencies] = React.useState<Currency[]>([])

  const reset = () => {
    setSearchText("")
    setMatchingCurrencies(data?.currencyList?.slice() ?? [])
  }

  React.useEffect(() => {
    data?.currencyList && setMatchingCurrencies(data.currencyList.slice())
  }, [data?.currencyList])

  const updateMatchingCurrency = useCallback(
    (newSearchText: string) => {
      if (!data?.currencyList) {
        return
      }
      setSearchText(newSearchText)

      const currencies = data.currencyList.slice()
      const matchSearch = getMatchingCurrencies(newSearchText, currencies)
      const currencyWithSearch = newSearchText.length > 0 ? matchSearch : currencies

      // make sure the display currency is always in the list
      if (!currencyWithSearch.find((c) => c.id === displayCurrency)) {
        const currency = currencies.find((c) => c.id === displayCurrency)
        currency && currencyWithSearch.push(currency)
      }

      // sort to make sure selection currency always on top
      currencyWithSearch.sort((a, b) => {
        if (a.id === displayCurrency) {
          return -1
        }
        if (b.id === displayCurrency) {
          return 1
        }
        return 0
      })

      setMatchingCurrencies(currencyWithSearch)
    },
    [data?.currencyList, displayCurrency],
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!data?.currencyList) {
    return <Text>{LL.DisplayCurrencyScreen.errorLoading()}</Text>
  }

  const handleCurrencyChange = async (currencyId: string) => {
    if (loading) return
    await setDisplayCurrency(currencyId)
    setNewCurrency(currencyId)
  }

  return (
    <Screen preset="scroll">
      <SearchBar
        {...testProps(LL.common.search())}
        placeholder={LL.common.search()}
        value={searchText}
        onChangeText={updateMatchingCurrency}
        platform="default"
        round
        showLoading={false}
        containerStyle={styles.searchBarContainer}
        inputContainerStyle={styles.searchBarInputContainerStyle}
        inputStyle={styles.searchBarText}
        rightIconContainerStyle={styles.searchBarRightIconStyle}
        searchIcon={<GaloyIcon name="magnifying-glass" size={24} />}
        clearIcon={
          <TouchableOpacity onPress={reset}>
            <GaloyIcon name="close" size={24} />
          </TouchableOpacity>
        }
      />
      <MenuSelect
        value={newCurrency || displayCurrency || ""}
        onChange={handleCurrencyChange}
      >
        {matchingCurrencies.map((currency) => (
          <MenuSelectItem key={currency.id} value={currency.id}>
            {currency.id} - {currency.name} {currency.flag && `- ${currency.flag}`}
          </MenuSelectItem>
        ))}
      </MenuSelect>
    </Screen>
  )
}

export const wordMatchesCurrency = (searchWord: string, currency: Currency): boolean => {
  const matchForName = currency.name.toLowerCase().includes(searchWord.toLowerCase())
  const matchForId = currency.id.toLowerCase().includes(searchWord.toLowerCase())

  return matchForName || matchForId
}

export const getMatchingCurrencies = (searchText: string, currencies: Currency[]) => {
  const searchWordArray = searchText.split(" ").filter((text) => text.trim().length > 0)

  return currencies.filter((currency) =>
    searchWordArray.some((word) => wordMatchesCurrency(word, currency)),
  )
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 0,
    borderTopWidth: 0,
    marginHorizontal: 26,
    marginVertical: 8,
    paddingTop: 8,
  },

  searchBarInputContainerStyle: {
    backgroundColor: colors.grey5,
  },

  searchBarRightIconStyle: {
    padding: 8,
  },

  searchBarText: {
    color: colors.black,
    textDecorationLine: "none",
  },
}))
