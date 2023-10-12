/* eslint-disable react-native/no-inline-styles */
import * as React from "react"
import I18n from "i18n-js"
import { useEffect, useState } from "react"
import { StatusBar, Text, View, ScrollView, TouchableWithoutFeedback } from "react-native"
import { Button } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import Modal from "react-native-modal"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/Ionicons"
import { CloseCross } from "../../components/close-cross"
import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import { shuffle } from "../../utils/helper"
import { sleep } from "../../utils/sleep"
import { SVGs } from "./earn-svg-factory"
import type { ScreenType } from "../../types/jsx"
import { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

const styles = EStyleSheet.create({
  answersView: {
    flex: 1,
    marginHorizontal: 15,
    marginTop: 6,
    height: 500,
  },

  bottomContainer: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0,
    shadowColor: palette.grey2,
    shadowOpacity: 5,
    shadowRadius: 8,
  },

  buttonStyle: {
    backgroundColor: palette.lightBlue,
    borderRadius: 32,
    width: 224,
  },

  completedTitleStyle: {
    color: palette.lightBlue,
    fontSize: 18,
    fontWeight: "bold",
  },

  correctAnswerText: {
    color: palette.green,
    fontSize: 16,
  },

  incorrectAnswerText: {
    color: palette.red,
    fontSize: 16,
  },

  keepDiggingContainerStyle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    marginTop: 18,
    minHeight: 18,
  },

  modalBackground: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    justifyContent: "flex-end",
    minHeight: 630,
  },

  quizButtonContainerStyle: {
    marginVertical: 12,
    width: 48,
  },

  quizButtonStyle: {
    backgroundColor: palette.lightBlue,
    borderRadius: 32,
    padding: 12,
  },

  quizButtonTitleStyle: {
    color: palette.white,
    fontWeight: "bold",
  },

  quizCorrectButtonStyle: {
    backgroundColor: palette.green,
    borderRadius: 32,
    padding: 12,
  },

  quizTextAnswer: {
    color: palette.darkGrey,
    textAlign: "left",
    width: "100%",
  },

  quizTextContainerStyle: {
    alignItems: "flex-start",
    marginLeft: 12,
    marginRight: 36,
  },

  quizWrongButtonStyle: {
    backgroundColor: palette.red,
    borderRadius: 32,
    padding: 12,
  },

  svgContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },

  text: {
    fontSize: 24,
  },

  textContainer: {
    marginHorizontal: 24,
    paddingBottom: 48,
  },

  textEarn: {
    color: palette.darkGrey,
    fontSize: 16,
    fontWeight: "bold",
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
    paddingBottom: 5,
  },

  titleStyle: {
    color: palette.white,
    fontSize: 18,
    fontWeight: "bold",
  },
})

const mappingLetter = { 0: "A", 1: "B", 2: "C" }

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "earnsQuiz">
  route: RouteProp<RootStackParamList, "earnsQuiz">
}

export const EarnQuiz: ScreenType = ({ route, navigation }: Props) => {
  const { title, text, amount, answers, feedback, question, onComplete, id, completed } =
    route.params

  const [isCompleted, setIsCompleted] = useState(completed)
  const [quizVisible, setQuizVisible] = useState(false)
  const [recordedAnswer, setRecordedAnswer] = useState([])
  const [permutation] = useState(shuffle([0, 1, 2]))

  const addRecordedAnswer = (value) => {
    setRecordedAnswer([...recordedAnswer, value])
  }

  const answersShuffled = []

  useEffect(() => {
    if (recordedAnswer.indexOf(0) !== -1) {
      setIsCompleted(true)
      onComplete()
    }
  }, [onComplete, recordedAnswer])

  const close = async () => {
    StatusBar.setBarStyle("light-content")
    if (quizVisible) {
      setQuizVisible(false)
      await sleep(100)
    }
    navigation.goBack()
  }

  type ZeroTo2 = 0 | 1 | 2

  const buttonStyleHelper = (i: ZeroTo2) => {
    return recordedAnswer.indexOf(i) === -1
      ? styles.quizButtonStyle
      : i === 0
      ? styles.quizCorrectButtonStyle
      : styles.quizWrongButtonStyle
  }

  let j: ZeroTo2 = 0
  permutation.forEach((i) => {
    answersShuffled.push(
      <TouchableWithoutFeedback>
        <View key={i} style={{ width: "100%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
            <Button
              title={mappingLetter[j]}
              buttonStyle={buttonStyleHelper(i)}
              disabledStyle={buttonStyleHelper(i)}
              titleStyle={styles.quizButtonTitleStyle}
              disabledTitleStyle={styles.quizButtonTitleStyle}
              containerStyle={styles.quizButtonContainerStyle}
              onPress={() => addRecordedAnswer(i)}
              disabled={recordedAnswer.indexOf(0) !== -1}
            />
            <Button
              title={answers[i]}
              titleStyle={styles.quizTextAnswer}
              disabledTitleStyle={styles.quizTextAnswer}
              containerStyle={styles.quizTextContainerStyle}
              // disabledStyle={styles.quizTextContainerStyle}
              type="clear"
              onPress={() => addRecordedAnswer(i)}
              disabled={recordedAnswer.indexOf(0) !== -1}
            />
          </View>
          {recordedAnswer.length > 0 &&
          recordedAnswer.indexOf(i) === recordedAnswer.length - 1 ? (
            <Text style={i === 0 ? styles.correctAnswerText : styles.incorrectAnswerText}>
              {feedback[i]}
            </Text>
          ) : null}
        </View>
      </TouchableWithoutFeedback>,
    )
    j = (j + 1) as ZeroTo2
  })

  return (
    <Screen backgroundColor={palette.lighterGrey} unsafe>
      <Modal
        style={{ marginHorizontal: 0, marginBottom: 0, flexGrow: 1 }}
        isVisible={quizVisible}
        swipeDirection={quizVisible ? ["down"] : ["up"]}
        onSwipeComplete={() => setQuizVisible(false)}
        swipeThreshold={50}
        propagateSwipe
      >
        {/* TODO: expand automatically */}
        <View style={{ flexShrink: 1 }}>
          <TouchableWithoutFeedback onPress={() => setQuizVisible(false)}>
            <View style={{ height: "100%", width: "100%" }} />
          </TouchableWithoutFeedback>
        </View>
        <View style={styles.modalBackground}>
          <View style={{ height: 14 }}>
            <Icon
              name="ios-remove"
              size={72}
              color={palette.lightGrey}
              style={{ height: 40, top: -30 }}
            />
          </View>
          <View style={{ flex: 1 }}>
             <ScrollView style={styles.answersView}>
              <Text style={styles.title}>{question ?? title}</Text>
              {answersShuffled}
            </ScrollView>
            <View>
              {recordedAnswer.indexOf(0) !== -1 ? (
                <Button
                  title={translate("EarnScreen.keepDigging")}
                  type="outline"
                  onPress={async () => close()}
                  containerStyle={styles.keepDiggingContainerStyle}
                  buttonStyle={styles.buttonStyle}
                  titleStyle={styles.titleStyle}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
      <SafeAreaView style={{ flex: 1, paddingBottom: 0 }}>
        <ScrollView persistentScrollbar showsVerticalScrollIndicator bounces>
          <View style={styles.svgContainer}>{SVGs({ name: id, theme: "dark" })}</View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{text}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      <CloseCross onPress={async () => close()} color={palette.darkGrey} />
      <SafeAreaView style={styles.bottomContainer}>
        <View style={{ paddingVertical: 12 }}>
          {(completed && (
            <>
              <Text style={styles.textEarn}>
                {translate("EarnScreen.quizComplete", { amount })}
              </Text>
              <Button
                title={translate("EarnScreen.reviewQuiz")}
                type="clear"
                titleStyle={styles.completedTitleStyle}
                onPress={() => setQuizVisible(true)}
              />
            </>
          )) || (
            <Button
              title={I18n.t("EarnScreen.earnSats", {
                count: amount,
                formatted_number: I18n.toNumber(amount, { precision: 0 }),
              })}
              buttonStyle={styles.buttonStyle}
              titleStyle={styles.titleStyle}
              onPress={() => setQuizVisible(true)}
            />
          )}
        </View>
      </SafeAreaView>
    </Screen>
  )
}
