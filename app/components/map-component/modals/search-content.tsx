import { FC, useState } from "react"
import { View, ScrollView, TouchableOpacity } from "react-native"
import { ListItem, makeStyles, SearchBar, Text } from "@rneui/themed"
import { Dimensions } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"

type SearchContentProps = {
  closeModal: () => void
}

export const SearchContent: FC<SearchContentProps> = ({ closeModal }) => {
  const styles = useStyles()
  const { height: screenHeight } = Dimensions.get("window")
  const [search, setSearch] = useState("")

  const updateSearch = (search: string) => {
    setSearch(search)
  }
  return (
    <View style={{ minHeight: screenHeight - 300, maxHeight: screenHeight - 300 }}>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal}>Search</Text>
        <Icon
          color="grey"
          name="close"
          size={22}
          style={{ paddingHorizontal: 1 }}
          onPress={closeModal}
        />
      </View>
      <SearchBar
        containerStyle={{
          backgroundColor: "transparent",
          borderColor: "transparent",
        }}
        round
        inputContainerStyle={{ height: 40 }}
        inputStyle={{ fontSize: 15 }}
        onChangeText={updateSearch}
        value={search}
        lightTheme
        placeholder="Search for cities, Locations..."
        placeholderTextColor="#888"
        searchIcon={
          <Icon
            color="grey"
            name="search"
            size={18}
            style={{ paddingHorizontal: 1 }}
            onPress={closeModal}
          />
        }
        clearIcon={
          <Icon
            color="grey"
            name="close"
            size={18}
            style={{ paddingHorizontal: 1 }}
            onPress={() => updateSearch("")}
          />
        }
      />
      <ScrollView>
        {Array.from({ length: 20 }).map((_, index) => (
          <TouchableOpacity onPress={() => {}}>
            <ListItem containerStyle={styles.list}>
              <Icon name="location-outline" size={15} style={styles.listIcon} />
              <ListItem.Title>Chalchuapa, Bitcoint El Salvador</ListItem.Title>
            </ListItem>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
    fontSize: "0.5rem",
    backgroundColor: "transparent",
  },
  listIcon: {
    color: colors.black,
  },
}))
