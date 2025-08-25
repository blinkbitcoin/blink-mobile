import { FC, useState } from "react"
import { View, ScrollView, TouchableOpacity } from "react-native"
import { CheckBox, makeStyles, Text, useTheme } from "@rneui/themed"
import { Dimensions } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"

type FiltersContentProps = {
  closeModal: () => void
}

export const FiltersContent: FC<FiltersContentProps> = ({ closeModal }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { height: screenHeight } = Dimensions.get("window")
  const filterData = [
    { id: 1, icon: "cash-outline", label: "ATM", checked: false },
    { id: 2, icon: "beer", label: "Bar", checked: false },
    { id: 3, icon: "cafe", label: "Cafe", checked: false },
    { id: 4, icon: "business", label: "Hotel", checked: false },
    { id: 5, icon: "storefront", label: "Pub", checked: false },
    { id: 6, icon: "restaurant", label: "Restauran", checked: false },
    { id: 7, icon: "ellipsis-horizontal", label: "Other", checked: false },
  ]
  const [filters, setFilters] = useState(filterData)
  const toggleCheck = (id: number) => {
    setFilters(
      filters.map((filter) =>
        filter.id === id ? { ...filter, checked: !filter.checked } : filter,
      ),
    )
  }
  const selectAll = () => {
    setFilters(filters.map((filter) => ({ ...filter, checked: true })))
  }

  const deselectAll = () => {
    setFilters(filters.map((filter) => ({ ...filter, checked: false })))
  }
  return (
    <View style={{ minHeight: screenHeight - 300, maxHeight: screenHeight - 300 }}>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal}>Categories filters</Text>
        <Icon
          color="grey"
          name="close"
          size={22}
          style={{ paddingHorizontal: 1 }}
          onPress={closeModal}
        />
      </View>
      <Text color="grey">Choose which categories you would like to show</Text>
      <ScrollView style={{ paddingTop: 20 }}>
        {filters.map((filter) => (
          <View key={filter.id} style={styles.listContent}>
            <View style={styles.listCheck}>
              <Icon name={filter.icon} size={22} style={styles.listIcon} />
              <Text style={styles.titleFilter}>{filter.label}</Text>
            </View>
            <CheckBox
              checked={filter.checked}
              onPress={() => toggleCheck(filter.id)}
              containerStyle={styles.checkBox}
              checkedIcon={<Icon name="checkbox" color={colors.primary} size={22} />}
              uncheckedIcon={<Icon name="square-outline" color="grey" size={22} />}
            />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={deselectAll}>
          <Text color={colors.primary}>Deselect All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={selectAll}>
          <Text color={colors.primary}>Select All</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  titleContent: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  titleModal: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
  },
  listContent: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    marginBottom: 10,
  },
  listCheck: {
    alignItems: "center",
    flexDirection: "row",
  },
  titleFilter: {
    fontSize: 15,
  },
  listIcon: {
    color: colors.black,
    paddingRight: 7,
  },
  checkBox: {
    backgroundColor: "transparent",
    padding: 0,
    margin: 0,
    right: -10,
  },
}))
