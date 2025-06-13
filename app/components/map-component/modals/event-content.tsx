import { FC } from "react"
import { View, TouchableOpacity } from "react-native"
import { makeStyles, Text, useTheme } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

type EventContentProps = {
  closeModal: () => void
}

export const EventContent: FC<EventContentProps> = ({ closeModal }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal} ellipsizeMode="tail" numberOfLines={1}>
          Five Start Hotel SV
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
      <Text style={styles.locationTitle}>Hotel</Text>
      {Array.from({ length: 4 }).map((_, index) => (
        <View style={styles.eventDetails}>
          <Text style={styles.detailsTitle}>Hotel:</Text>
          <Text style={styles.detailsTitle}>123</Text>
        </View>
      ))}
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
  },
}))
