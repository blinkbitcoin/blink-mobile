/* eslint-disable react-native/no-inline-styles */
import * as React from "react"
import { useEffect, useState } from "react"
import {
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Pressable,
} from "react-native"
import { ScrollView } from "react-native-gesture-handler"
import Modal from "react-native-modal"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/Ionicons"

import { FetchResult, gql } from "@apollo/client"
import { QuizClaimMutation, useQuizClaimMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Button } from "@rn-vui/base"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { CloseCross } from "../../components/close-cross"
import { Screen } from "../../components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { shuffle } from "../../utils/helper"
import { sleep } from "../../utils/sleep"
import { useQuizServer } from "../earns-map-screen/use-quiz-server"
import { SVGs } from "./earn-svg-factory"
import {
  augmentCardWithGqlData,
  errorCodeAlertAlreadyShown,
  getQuizQuestionsContent,
  markErrorCodeAlertAsShown,
  skipRewardErrorCodes,
} from "./helpers"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { ValidateQuizCodeErrorsType } from "./sections"

const useStyles = makeStyles(({ colors }) => ({
  answersViewInner: {
    rowGap: 20,
  },
  answersView: {
    padding: 20,
  },
  scrollViewStyle: {
    width: "100%",
  },

  bottomContainer: {
    alignItems: "center",
    backgroundColor: colors._white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0,
    shadowColor: colors.grey2,
    shadowOpacity: 5,
    shadowRadius: 8,
  },

  buttonStyle: {
    backgroundColor: colors._lightBlue,
    borderRadius: 32,
    width: 224,
  },

  completedTitleStyle: {
    color: colors._lightBlue,
    fontSize: 18,
    fontWeight: "bold",
  },

  correctAnswerText: {
    color: colors._green,
    flex: 1,
    fontSize: 16,
  },

  incorrectAnswerText: {
    color: colors.error,
    fontSize: 16,
    flex: 1,
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
    backgroundColor: colors._white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    justifyContent: "flex-end",
    height: 630,
  },

  quizButtonContainerStyle: {
    marginVertical: 12,
    width: 48,
  },

  buttonRow: {
    flexDirection: "row",
    columnGap: 20,
    alignItems: "center",
  },

  quizButtonStyle: {
    backgroundColor: colors._lightBlue,
    height: 50,
    width: 50,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  quizButtonTitleStyle: {
    color: colors._white,
    fontWeight: "bold",
    fontSize: 16,
  },

  quizCorrectButtonStyle: {
    backgroundColor: colors._green,
    height: 50,
    width: 50,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  quizWrongButtonStyle: {
    backgroundColor: colors.error,
    height: 50,
    width: 50,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  svgContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },

  text: {
    fontSize: 24,
    color: colors._black,
  },

  answerChoiceText: {
    fontSize: 20,
    flex: 1,
    color: colors._black,
  },

  textContainer: {
    marginHorizontal: 24,
    paddingBottom: 48,
  },

  textEarn: {
    color: colors._darkGrey,
    fontSize: 16,
    fontWeight: "bold",
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    paddingBottom: 12,
    color: colors._black,
  },

  titleStyle: {
    color: colors._white,
    fontSize: 18,
    fontWeight: "bold",
  },

  buttonRowWithFeedback: {
    rowGap: 10,
    flex: 1,
  },

  modalBodyText: {
    fontSize: 17,
    color: colors.black,
    textAlign: "left",
  },

  modalBody: {
    textAlign: "center",
    marginTop: 20,
  },
}))

const mappingLetter = { 0: "A", 1: "B", 2: "C" }

type Props = {
  route: RouteProp<RootStackParamList, "earnsQuiz">
}

gql`
  mutation quizClaim($input: QuizClaimInput!) {
    quizClaim(input: $input) {
      errors {
        message
        code
      }
      quizzes {
        id
        amount
        completed
        notBefore
      }
    }
  }
`

export const EarnQuiz = ({ route }: Props) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const { LL } = useI18nContext()
  const quizQuestionsContent = getQuizQuestionsContent({ LL })
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "earnsQuiz">>()

  const [permutation] = useState<ZeroTo2[]>(shuffle([0, 1, 2]))

  const { quizServerData } = useQuizServer()

  const { id, isAvailable } = route.params

  const allCards = React.useMemo(
    () => quizQuestionsContent.map((item) => item.content).flatMap((item) => item),
    [quizQuestionsContent],
  )

  const cardNoMetadata = React.useMemo(
    () => allCards.find((item) => item.id === id),
    [allCards, id],
  )

  if (!cardNoMetadata) {
    // should never happen
    throw new Error("card not found")
  }

  const card = augmentCardWithGqlData({ card: cardNoMetadata, quizServerData })
  const { title, text, amount, answers, feedback, question, completed } = card

  const [quizClaim, { loading: quizClaimLoading }] = useQuizClaimMutation()
  const [quizVisible, setQuizVisible] = useState(false)
  const [recordedAnswer, setRecordedAnswer] = useState<number[]>([])
  const [hasTriedClaim, setHasTriedClaim] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [quizErrorMessage, setQuizErrorMessage] = useState<string>()
  const [quizErrorCode, setQuizErrorCode] = useState<
    string | null | ValidateQuizCodeErrorsType
  >()

  const addRecordedAnswer = (value: number) => {
    setRecordedAnswer([...recordedAnswer, value])
  }

  const claimQuizWrapper = React.useCallback(
    async (skipRewards?: boolean): Promise<FetchResult<QuizClaimMutation>> => {
      const result = await quizClaim({
        variables: { input: { id, skipRewards } },
      })
      const errorCode = result.data?.quizClaim?.errors[0]
        ?.code as ValidateQuizCodeErrorsType

      if (!skipRewardErrorCodes(errorCode) && result.data?.quizClaim?.errors?.length) {
        navigation.goBack()
        toastShow({
          message: getErrorMessages(result.data.quizClaim.errors),
          LL,
        })
      }
      return result
    },
    [quizClaim, id, LL, navigation],
  )

  const getModalErrorMessages = React.useCallback(
    (
      quizErrorCode: ValidateQuizCodeErrorsType,
    ): {
      title: string
      message: string
    } => {
      switch (quizErrorCode) {
        case "INVALID_PHONE_FOR_QUIZ":
          return {
            title: LL.EarnScreen.customMessages.invalidPhoneForQuiz.title(),
            message: LL.EarnScreen.customMessages.invalidPhoneForQuiz.message(),
          }
        case "INVALID_IP_METADATA":
          return {
            title: LL.EarnScreen.customMessages.invalidIpMetadata.title(),
            message: LL.EarnScreen.customMessages.invalidIpMetadata.message(),
          }
        case "QUIZ_CLAIMED_TOO_EARLY":
          return {
            title: LL.EarnScreen.customMessages.claimedTooEarly.title(),
            message: LL.EarnScreen.customMessages.claimedTooEarly.message(),
          }
        case "NOT_ENOUGH_BALANCE_FOR_QUIZ":
          return {
            title: LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.title(),
            message: LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.message(),
          }
        case "INVALID_QUIZ_QUESTION_ID":
          return {
            title: LL.EarnScreen.customMessages.invalidQuizQuestionId.title(),
            message: LL.EarnScreen.customMessages.invalidQuizQuestionId.message(),
          }
        default:
          return {
            title: LL.EarnScreen.somethingNotRight(),
            message: quizErrorMessage ?? LL.EarnScreen.customErrorMessage(),
          }
      }
    },
    [LL, quizErrorMessage],
  )

  const handleClaimWithoutRewards = React.useCallback(async () => {
    markErrorCodeAlertAsShown(quizErrorCode)
    await claimQuizWrapper(true)
    setShowModal(false)
  }, [claimQuizWrapper, quizErrorCode])

  const answersShuffled: Array<React.ReactNode> = []

  useEffect(() => {
    ;(async () => {
      if (hasTriedClaim) return
      if (recordedAnswer.indexOf(0) !== -1 && !completed && !quizClaimLoading) {
        setHasTriedClaim(true)
        const { data } = await claimQuizWrapper(false)

        if (data?.quizClaim?.errors?.length) {
          const errorCode = data.quizClaim.errors[0]?.code as ValidateQuizCodeErrorsType
          const defaultErrorMessage = LL.EarnScreen.defaultErrorMessage({
            errorMessage: getErrorMessages(data.quizClaim.errors),
          })

          if (skipRewardErrorCodes(errorCode)) {
            if (errorCodeAlertAlreadyShown(errorCode)) {
              await handleClaimWithoutRewards()
              return
            }
            setQuizErrorMessage(defaultErrorMessage)
            setQuizErrorCode(errorCode)
            setShowModal(true)
          }
        }
      }
    })()
  }, [
    recordedAnswer,
    claimQuizWrapper,
    LL,
    completed,
    quizClaimLoading,
    hasTriedClaim,
    handleClaimWithoutRewards,
  ])

  const closeModal = () => {
    setShowModal(false)
    navigation.navigate("Earn")
  }

  const close = async () => {
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
      <View key={i} style={styles.buttonRowWithFeedback}>
        <TouchableOpacity onPress={() => addRecordedAnswer(i)}>
          <View style={styles.buttonRow}>
            <View style={buttonStyleHelper(i)}>
              <Text style={styles.quizButtonTitleStyle}>{mappingLetter[j]}</Text>
            </View>
            <Text style={styles.answerChoiceText}>{answers[i]}</Text>
          </View>
        </TouchableOpacity>
        {recordedAnswer.length > 0 &&
        recordedAnswer.indexOf(i) === recordedAnswer.length - 1 ? (
          <Text style={i === 0 ? styles.correctAnswerText : styles.incorrectAnswerText}>
            {feedback[i]}
          </Text>
        ) : null}
      </View>,
    )
    j = (j + 1) as ZeroTo2
  })

  return (
    <Screen backgroundColor={colors._lighterGrey} unsafe>
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
              name="remove"
              size={72}
              color={colors._lightGrey}
              style={{ height: 40, top: -30 }}
            />
          </View>
          <ScrollView
            style={styles.scrollViewStyle}
            contentContainerStyle={styles.answersView}
          >
            <Pressable style={styles.answersViewInner}>
              <Text style={styles.title}>{question ?? title}</Text>
              {answersShuffled}
            </Pressable>
          </ScrollView>
          <View>
            {recordedAnswer.indexOf(0) === -1 ? null : (
              <Button
                title={LL.EarnScreen.keepDigging()}
                type="outline"
                onPress={async () => close()}
                containerStyle={styles.keepDiggingContainerStyle}
                buttonStyle={styles.buttonStyle}
                titleStyle={styles.titleStyle}
              />
            )}
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
      <CloseCross onPress={async () => close()} color={colors._darkGrey} />
      <SafeAreaView style={styles.bottomContainer}>
        <View style={{ paddingVertical: 12 }}>
          {(completed && (
            <>
              <Text style={styles.textEarn}>
                {isAvailable
                  ? LL.EarnScreen.quizComplete({ formattedNumber: amount })
                  : LL.EarnScreen.sectionsCompleted()}
              </Text>
              <Button
                title={LL.EarnScreen.reviewQuiz()}
                type="clear"
                titleStyle={styles.completedTitleStyle}
                onPress={() => setQuizVisible(true)}
              />
            </>
          )) || (
            <Button
              title={
                isAvailable
                  ? LL.EarnScreen.earnSats({
                      formattedNumber: amount,
                    })
                  : LL.common.continue()
              }
              buttonStyle={styles.buttonStyle}
              titleStyle={styles.titleStyle}
              onPress={() => setQuizVisible(true)}
            />
          )}
        </View>
      </SafeAreaView>
      <CustomModal
        isVisible={showModal}
        toggleModal={closeModal}
        title={getModalErrorMessages(quizErrorCode as ValidateQuizCodeErrorsType).title}
        backgroundModalColor={colors.white}
        body={
          <View style={styles.modalBody}>
            <Text style={styles.modalBodyText}>
              {getModalErrorMessages(quizErrorCode as ValidateQuizCodeErrorsType).message}
            </Text>
          </View>
        }
        primaryButtonOnPress={handleClaimWithoutRewards}
        primaryButtonTitle={LL.EarnScreen.continueNoRewards()}
        secondaryButtonTitle={LL.common.close()}
        secondaryButtonOnPress={closeModal}
      />
    </Screen>
  )
}
