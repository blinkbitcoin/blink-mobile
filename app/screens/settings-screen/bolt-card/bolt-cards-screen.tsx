import * as React from "react"
import { useState, useEffect } from "react"
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Divider, Icon, ListItem } from "react-native-elements"
import { useMutation, useQuery } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"

import { Screen } from "../../../components/screen"
import { translate } from "../../../i18n"
import { palette } from "../../../theme/palette"
import { RootStackParamList } from "../../../navigation/stack-param-lists"
import { BOLT_CARDS_QUERY, BOLT_CARD_DISABLE_MUTATION } from "../../../graphql/query"
import { formatDate } from "../../../utils/date"
import nfcManager from "react-native-nfc-manager"

type BoltCardsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "boltCards">
}

export const BoltCardsScreen: React.FC<BoltCardsScreenProps> = ({ navigation }) => {
  const { data, loading, error, refetch } = useQuery(BOLT_CARDS_QUERY)
  const [disableCard] = useMutation(BOLT_CARD_DISABLE_MUTATION)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      refetch()
    })
    return unsubscribe
  }, [navigation, refetch])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleDisableCard = async (cardId: string) => {
    Alert.alert(
      translate("BoltCardScreen.disableCardTitle"),
      translate("BoltCardScreen.disableCardMessage"),
      [
        {
          text: translate("common.cancel"),
          style: "cancel",
        },
        {
          text: translate("common.disable"),
          style: "destructive",
          onPress: async () => {
            try {
              await disableCard({
                variables: {
                  input: {
                    id: cardId,
                  },
                },
                refetchQueries: [{ query: BOLT_CARDS_QUERY }],
              })
              Alert.alert(
                translate("common.success"),
                translate("BoltCardScreen.cardDisabled"),
              )
            } catch (err) {
              Alert.alert(translate("common.error"), err.toString())
            }
          },
        },
      ],
    )
  }

  const renderCard = ({ item }) => {
    return (
      <ListItem
        onPress={() => navigation.navigate("boltCardDetail", { cardId: item.id })}
        bottomDivider
      >
        <Icon
          name={item.enabled ? "credit-card-outline" : "credit-card-off-outline"}
          type="material-community"
          color={item.enabled ? palette.darkGrey : palette.lightGrey}
        />
        <ListItem.Content>
          <ListItem.Title style={item.enabled ? styles.cardTitle : styles.cardTitleDisabled}>
            {item.cardName}
          </ListItem.Title>
          <ListItem.Subtitle style={styles.cardSubtitle}>
            {translate("BoltCardScreen.lastUsed")}: {item.lastUsedAt ? formatDate({ createdAt: item.lastUsedAt, showFullDate: false }) : translate("BoltCardScreen.never")}
          </ListItem.Subtitle>
        </ListItem.Content>
        <ListItem.Chevron />
      </ListItem>
    )
  }

  const renderEmptyList = () => {
    if (loading) return null
    
    return (
      <View style={styles.emptyContainer}>
        <Icon
          name="card-outline"
          type="material-community"
          size={64}
          color={palette.lightGrey}
        />
        <Text style={styles.emptyText}>{translate("BoltCardScreen.noCards")}</Text>
      </View>
    )
  }

  const renderError = () => {
    if (!error) return null
    
    return (
      <View style={styles.errorContainer}>
        <Icon
          name="alert-circle-outline"
          type="material-community"
          size={64}
          color={palette.red}
        />
        <Text style={styles.errorText}>{translate("common.error")}</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
      </View>
    )
  }

  return (
    <Screen preset="scroll">
      {error ? (
        renderError()
      ) : (
        <>
          <FlatList
            data={data?.boltCards || []}
            renderItem={renderCard}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyList}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
          <Divider style={styles.divider} />
          <ListItem onPress={() => navigation.navigate("boltCardRegister")}>
            <Icon name="plus-circle-outline" type="material-community" color={palette.darkGrey} />
            <ListItem.Content>
              <ListItem.Title>{translate("BoltCardScreen.registerNewCard")}</ListItem.Title>
            </ListItem.Content>
          </ListItem>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: palette.lighterGrey,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: palette.darkGrey,
  },
  cardTitleDisabled: {
    fontSize: 16,
    fontWeight: "bold",
    color: palette.lightGrey,
  },
  cardSubtitle: {
    fontSize: 12,
    color: palette.midGrey,
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    marginHorizontal: 5,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: palette.midGrey,
    textAlign: "center",
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "bold",
    color: palette.red,
    textAlign: "center",
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: palette.midGrey,
    textAlign: "center",
  },
}) 