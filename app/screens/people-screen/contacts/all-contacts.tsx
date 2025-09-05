import * as React from "react"
import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { FlatList } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import { UserContact, useContactsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PeopleStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"
import { useAppConfig } from "@app/hooks"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { SearchBar } from "@rn-vui/base"
import { ListItem, makeStyles, useTheme } from "@rn-vui/themed"

gql`
  query contacts {
    me {
      id
      contacts {
        id
        handle
        username
        alias
        transactionsCount
      }
    }
  }
`

export const AllContactsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const navigation = useNavigation<StackNavigationProp<PeopleStackParamList>>()

  const isAuthed = useIsAuthed()

  const [matchingContacts, setMatchingContacts] = useState<UserContact[]>([])
  const [searchText, setSearchText] = useState("")
  const { LL } = useI18nContext()
  const { loading, data, error } = useContactsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  if (error) {
    toastShow({ message: error.message, LL })
  }

  const contacts: UserContact[] = useMemo(() => {
    return data?.me?.contacts.slice() ?? []
  }, [data])

  const reset = useCallback(() => {
    setSearchText("")
    setMatchingContacts(contacts)
  }, [contacts])

  React.useEffect(() => {
    setMatchingContacts(contacts)
  }, [contacts])

  // This implementation of search will cause a match if any word in the search text
  // matches the contacts name or prettyName.
  const updateMatchingContacts = useCallback(
    (newSearchText: string) => {
      setSearchText(newSearchText)
      if (newSearchText.length > 0) {
        const searchWordArray = newSearchText
          .split(" ")
          .filter((text) => text.trim().length > 0)
        const matchingContacts = contacts.filter((contact) =>
          searchWordArray.some((word) => wordMatchesContact(word, contact)),
        )
        setMatchingContacts(matchingContacts)
      } else {
        setMatchingContacts(contacts)
      }
    },
    [contacts],
  )

  const wordMatchesContact = (searchWord: string, contact: UserContact): boolean => {
    let contactPrettyNameMatchesSearchWord: boolean

    const contactNameMatchesSearchWord = contact.handle
      .toLowerCase()
      .includes(searchWord.toLowerCase())

    if (contact.alias) {
      contactPrettyNameMatchesSearchWord = contact.alias
        .toLowerCase()
        .includes(searchWord.toLowerCase())
    } else {
      contactPrettyNameMatchesSearchWord = false
    }

    return contactNameMatchesSearchWord || contactPrettyNameMatchesSearchWord
  }

  let SearchBarContent: React.ReactNode
  let ListEmptyContent: React.ReactNode

  if (contacts.length > 0) {
    SearchBarContent = (
      <SearchBar
        {...testProps(LL.common.search())}
        placeholder={LL.common.search()}
        value={searchText}
        onChangeText={updateMatchingContacts}
        platform="default"
        round
        showLoading={false}
        containerStyle={styles.searchBarContainer}
        inputContainerStyle={styles.searchBarInputContainerStyle}
        inputStyle={styles.searchBarText}
        rightIconContainerStyle={styles.searchBarRightIconStyle}
        searchIcon={<Icon name="search" size={24} color={styles.icon.color} />}
        clearIcon={
          <Icon name="close" size={24} onPress={reset} color={styles.icon.color} />
        }
      />
    )
  } else {
    SearchBarContent = <></>
  }

  if (contacts.length > 0) {
    ListEmptyContent = (
      <View style={styles.emptyListNoMatching}>
        <Text style={styles.emptyListTitle}>{LL.PeopleScreen.noMatchingContacts()}</Text>
      </View>
    )
  } else if (loading) {
    ListEmptyContent = (
      <View style={styles.activityIndicatorContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  } else {
    ListEmptyContent = (
      <View style={styles.emptyListNoContacts}>
        <Text
          {...testProps(LL.PeopleScreen.noContactsTitle())}
          style={styles.emptyListTitle}
        >
          {LL.PeopleScreen.noContactsTitle()}
        </Text>
        <Text style={styles.emptyListText}>{LL.PeopleScreen.noContactsYet()}</Text>
      </View>
    )
  }

  return (
    <Screen>
      {SearchBarContent}
      <FlatList
        contentContainerStyle={styles.listContainer}
        data={matchingContacts}
        ListEmptyComponent={ListEmptyContent}
        renderItem={({ item }) => {
          const handle = item?.handle?.trim() ?? ""
          const displayHandle =
            handle && !handle.includes("@") ? `${handle}@${lnAddressHostname}` : handle

          return (
            <ListItem
              key={item.handle}
              style={styles.item}
              containerStyle={styles.itemContainer}
              onPress={() => navigation.navigate("contactDetail", { contact: item })}
            >
              <Icon name={"person-outline"} size={24} color={colors.primary} />
              <ListItem.Content>
                <ListItem.Title style={styles.itemText}>{displayHandle}</ListItem.Title>
              </ListItem.Content>
            </ListItem>
          )
        }}
        keyExtractor={(item) => item.handle}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  activityIndicatorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },

  emptyListNoContacts: {
    marginHorizontal: 12,
    marginTop: 32,
  },

  emptyListNoMatching: {
    marginHorizontal: 26,
    marginTop: 8,
  },

  emptyListText: {
    fontSize: 18,
    marginTop: 30,
    textAlign: "center",
    color: colors.black,
  },

  emptyListTitle: {
    color: colors.black,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },

  item: {
    marginHorizontal: 32,
    marginVertical: 8,
  },

  itemContainer: {
    borderRadius: 8,
    backgroundColor: colors.grey5,
  },

  listContainer: { flexGrow: 1 },

  searchBarContainer: {
    backgroundColor: colors.white,
    borderBottomColor: colors.white,
    borderTopColor: colors.white,
    marginHorizontal: 26,
    marginVertical: 8,
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

  itemText: { color: colors.black },

  icon: {
    color: colors.black,
  },
}))
