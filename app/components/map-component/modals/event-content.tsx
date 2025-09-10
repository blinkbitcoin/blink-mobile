import { FC } from "react"
import { View, TouchableOpacity, ScrollView, Dimensions } from "react-native"
import { makeStyles, Text, useTheme } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IMarker } from "@app/screens/map-screen/btc-map-interface"

type EventContentProps = {
  closeModal: () => void
  focusedMarker?: IMarker | null
}

export const EventContent: FC<EventContentProps> = ({ closeModal, focusedMarker }) => {
  const styles = useStyles()
  const { height: screenHeight } = Dimensions.get("window")
  const {
    theme: { colors },
  } = useTheme()
  console.log(focusedMarker?.tags["icon:android"])

  return (
    <View style={{ maxHeight: screenHeight - 400 }}>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal} ellipsizeMode="tail" numberOfLines={1}>
          {`${
            focusedMarker?.location?.tags["addr:street"] ||
            focusedMarker?.location?.tags["addr:city"] ||
            focusedMarker?.location?.tags["name"] ||
            ""
          }`}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon
            color="grey"
            name="share-social"
            size={22}
            style={{ paddingHorizontal: 1 }}
          />
          <Icon
            color="grey"
            name="close"
            size={22}
            style={{ paddingHorizontal: 1 }}
            onPress={closeModal}
          />
        </View>
      </View>
      <View
        style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 15 }}
      >
        <GaloyPrimaryButton
          title="Pay this bussines"
          containerStyle={{
            flex: 1,
          }}
          disabled
        />
        <TouchableOpacity onPress={() => {}}>
          <Icon color={colors.black} name="location" size={40} />
        </TouchableOpacity>
      </View>
      <Text style={styles.locationTitle}>{focusedMarker?.tags["icon:android"]}</Text>
      <ScrollView>
        {focusedMarker &&
          Object.entries(focusedMarker.location.tags).map(([key, value], index) => (
            <View key={index} style={styles.eventDetails}>
              <Text style={styles.detailsTitle}>{key}: </Text>
              <Text style={styles.detailsSubTitle} ellipsizeMode="tail" numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
      </ScrollView>
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
    fontSize: 18,
  },
  locationTitle: {
    flex: 1,
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
  eventDetails: {
    flexDirection: "row",
    gap: 5,
    marginVertical: 2,
  },
  detailsTitle: {
    fontSize: 16,
    flex: 1,
    fontWeight: "bold",
  },
  detailsSubTitle: {
    fontSize: 16,
    flex: 1,
  },
}))
