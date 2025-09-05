import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { useCountUp } from "use-count-up"

import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { getcBackValue } from "@app/components/circle"
import { PressableCard } from "@app/components/pressable-card"
import { useCirclesQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PeopleStackParamList } from "@app/navigation/stack-param-lists"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

export const CirclesCardPeopleHome = () => {
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<PeopleStackParamList>>()
  const { LL } = useI18nContext()

  const { data, loading, refetch } = useCirclesQuery({
    fetchPolicy: "cache-and-network",
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch]),
  )

  const peopleInInnerCircle =
    data?.me?.defaultAccount.welcomeProfile?.innerCircleAllTimeCount || 0
  const isLonely = peopleInInnerCircle === 0

  const [prevInnerCircleCount, setPrevInnerCircleCount] = useState(peopleInInnerCircle)

  const { value: peopleInInnerCircleCountUp, reset } = useCountUp({
    isCounting: true,
    start: prevInnerCircleCount,
    end: peopleInInnerCircle,
    duration: 1.2,
    onComplete: () => {
      setPrevInnerCircleCount(peopleInInnerCircle)
    },
  })

  useEffect(() => {
    if (prevInnerCircleCount !== peopleInInnerCircle) {
      reset()
    }
  }, [prevInnerCircleCount, peopleInInnerCircle, reset])

  const cBackValue = getcBackValue(Number(peopleInInnerCircleCountUp), 1, 100, 250, 360)

  const cBackStyles = {
    height: cBackValue,
    width: cBackValue,
    borderRadius: cBackValue / 2,
  }

  const openBlinkCirclesDashboard = () => navigation.navigate("circlesDashboard")

  return (
    <PressableCard onPress={openBlinkCirclesDashboard}>
      <View style={styles.container}>
        <View>
          <View style={styles.blinkCircles}>
            <Text type="h2">{LL.Circles.titleBlinkCircles()}</Text>
            <View style={styles.loadingInfoContainer}>
              {loading && (
                <View style={styles.loadingView}>
                  <Text type={"p3"}>{LL.Circles.fetchingLatestCircles()}</Text>
                  <ActivityIndicator />
                </View>
              )}
            </View>
          </View>
          <View style={styles.separator}></View>
        </View>
        <View>
          <Text type={isLonely ? "p1" : "p2"} style={styles.textCenter}>
            {LL.Circles.circlesExplainer()}
          </Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsNumber}>{peopleInInnerCircleCountUp}</Text>
          <Text style={styles.pointsText} type="p2">
            {LL.Circles.peopleYouWelcomed()}
          </Text>
        </View>
        <GaloySecondaryButton
          style={styles.viewCirclescta}
          title={LL.Circles.viewMyCircles()}
          onPress={openBlinkCirclesDashboard}
        />
        <View style={[styles.backdropCircle, cBackStyles]}></View>
      </View>
    </PressableCard>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    display: "flex",
    flexDirection: "column",
    marginBottom: 20,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 0,
    rowGap: 14,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  loadingInfoContainer: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 20,
  },
  loadingView: {
    flexDirection: "row",
    columnGap: 10,
  },
  blinkCircles: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
    marginTop: 8,
  },
  textCenter: {
    textAlign: "center",
  },
  pointsContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 10,
    minHeight: 62,
  },
  pointsNumber: {
    color: colors.black,
    fontWeight: "700",
    fontSize: 50,
  },
  pointsText: {
    paddingBottom: 8,
    maxWidth: 80,
  },
  backdropCircle: {
    position: "absolute",
    right: -150,
    bottom: -150,
    backgroundColor: colors.backdropWhite,
    zIndex: -10,
  },
  viewCirclescta: {
    marginTop: -10,
  },
}))
