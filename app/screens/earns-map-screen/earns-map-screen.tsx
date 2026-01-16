import * as React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler"
import { SvgProps } from "react-native-svg"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { MountainHeader } from "../../components/mountain-header"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import {
  augmentCardWithGqlData,
  getCardsFromSection,
  getQuizQuestionsContent,
} from "../earns-screen"
import { earnSections, EarnSectionType } from "../earns-screen/sections"
import BitcoinCircle from "./bitcoin-circle-01.svg"
import BottomStart from "./bottom-start-01.svg"
import LeftFinish from "./left-finished-01.svg"
import LeftLastOngoing from "./left-last-section-ongoing-01.svg"
import LeftLastTodo from "./left-last-section-to-do-01.svg"
import LeftComplete from "./left-section-completed-01.svg"
import LeftOngoing from "./left-section-ongoing-01.svg"
import LeftTodo from "./left-section-to-do-01.svg"
import RightFinish from "./right-finished-01.svg"
import RightFirst from "./right-first-section-to-do-01.svg"
import RightLastOngoing from "./right-last-section-ongoing-01.svg"
import RightLastTodo from "./right-last-section-to-do-01.svg"
import RightComplete from "./right-section-completed-01.svg"
import RightOngoing from "./right-section-ongoing-01.svg"
import RightTodo from "./right-section-to-do-01.svg"
import TextBlock from "./text-block-medium.svg"
import { useQuizServer } from "./use-quiz-server"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useState } from "react"

type SideType = "left" | "right"
interface IInBetweenTile {
  side: SideType
  position: number
  length: number
}

interface IBoxAdding {
  section: EarnSectionType
  text: string
  Icon: React.FunctionComponent<SvgProps>
  side: SideType
  position: number
  length: number
}

type ProgressProps = {
  progress: number
}

const BADGER_WIDTH = 134

const ProgressBar = ({ progress }: ProgressProps) => {
  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles()
  const balanceWidth = Number(`${progress * 100}`)

  return (
    <View style={styles.progressContainer}>
      {/* pass props to style object to remove inline style */}
      {/* eslint-disable react-native/no-inline-styles */}
      <View
        style={{ width: `${balanceWidth}%`, height: 3, backgroundColor: colors._white }}
      />
      {/* eslint-enable react-native/no-inline-styles */}
    </View>
  )
}

type FinishProps = {
  currSection: number
  length: number
}

export const EarnMapScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Earn">>()
  const { LL } = useI18nContext()
  const quizQuestionsContent = getQuizQuestionsContent({ LL })
  const sections = Object.keys(earnSections) as EarnSectionType[]

  const sectionsData = sections.map((section) => ({
    index: section,
    text: LL.EarnScreen.earnSections[section].title(),
    icon: BitcoinCircle,
  }))
  const styles = useStyles()

  let currSection = 0
  let progress = NaN

  const [showModal, setShowModal] = useState(false)
  const [notRewards, setNotRewards] = useState(false)
  const [selectedSection, setSelectedSection] = useState<EarnSectionType>(sections[0])

  const { loading, quizServerData, earnedSats } = useQuizServer({
    fetchPolicy: "network-only",
  })

  let canDoNextSection: boolean

  for (const section of sections) {
    const cardsOnSection = getCardsFromSection({
      section,
      quizQuestionsContent,
    })
    const cards = cardsOnSection.map((card) =>
      augmentCardWithGqlData({ card, quizServerData }),
    )

    const sectionCompleted = cards?.every((item) => item?.completed) ?? false

    if (sectionCompleted) {
      currSection += 1
    } else if (isNaN(progress)) {
      // get progress of the current section
      progress = cards?.filter((item) => item?.completed).length / cards.length || 0

      const notBefore = cards[cards.length - 1]?.notBefore
      canDoNextSection = !notBefore || new Date() > notBefore
    }
  }

  const Finish = ({ currSection, length }: FinishProps) => {
    if (currSection !== sectionsData.length) return null

    return (
      <>
        <Text style={styles.finishText}>{LL.EarnScreen.finishText()}</Text>
        {length % 2 ? <LeftFinish /> : <RightFinish />}
      </>
    )
  }

  const InBetweenTile: React.FC<IInBetweenTile> = ({
    side,
    position,
    length,
  }: IInBetweenTile) => {
    if (currSection < position) {
      if (position === length - 1) {
        return side === "left" ? <LeftLastTodo /> : <RightLastTodo />
      }

      return side === "left" ? <LeftTodo /> : <RightTodo />
    }
    if (currSection === position) {
      if (position === length - 1) {
        return (
          <>
            <View style={styles.position} />
            {side === "left" ? <LeftLastOngoing /> : <RightLastOngoing />}
          </>
        )
      }

      if (position === 0 && progress === 0) {
        return <RightFirst />
      }

      return side === "left" ? <LeftOngoing /> : <RightOngoing />
    }
    return side === "left" ? <LeftComplete /> : <RightComplete />
  }

  const BoxAdding: React.FC<IBoxAdding> = ({
    section,
    text,
    Icon,
    side,
    position,
    length,
  }: IBoxAdding) => {
    const styles = useStyles()

    const disabled = currSection < position
    const nextSectionNotYetAvailable = currSection === position && !canDoNextSection
    const progressSection = disabled ? 0 : currSection > position ? 1 : progress

    const onPress = () => {
      if (nextSectionNotYetAvailable) {
        setSelectedSection(section)
        if (notRewards) {
          navigation.navigate("earnsSection", {
            section,
            isAvailable: false,
          })
          return
        }
        setShowModal(true)
        return
      }
      navigation.navigate("earnsSection", {
        section,
        isAvailable: true,
      })
    }

    // rework this to pass props into the style object
    const boxStyle = StyleSheet.create({
      container: {
        position: "absolute",
        bottom:
          currSection === position ? (currSection === 0 && progress === 0 ? 30 : 80) : 30,
        left: side === "left" ? 35 : 200,
        opacity: disabled ? 0.5 : 1,
      },
    })

    return (
      <View>
        <InBetweenTile side={side} position={position} length={length} />

        <View style={boxStyle.container}>
          <View>
            <TouchableOpacity disabled={disabled} onPress={onPress}>
              <TextBlock />
              <View style={styles.fullView}>
                <ProgressBar progress={progressSection} />
                <Icon style={styles.icon} width={50} height={50} />
                <Text style={styles.textStyleBox}>{text}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  const SectionsComp = sectionsData
    .map((item, index) => (
      <BoxAdding
        key={item.index}
        section={item.index}
        text={item.text}
        Icon={item.icon}
        side={index % 2 ? "left" : "right"}
        position={index}
        length={sectionsData.length}
      />
    ))
    .reverse()

  const scrollViewRef: React.MutableRefObject<ScrollView | null> = React.useRef(null)

  React.useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd()
    }
  }, [])

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={colors._blue} />
        </View>
      </Screen>
    )
  }

  const backgroundColor = currSection < sectionsData.length ? colors._sky : colors._orange

  const continueNotRewards = () => {
    setNotRewards(true)
    setShowModal(false)
    navigation.navigate("earnsSection", {
      section: selectedSection,
      isAvailable: false,
    })
  }

  return (
    <Screen unsafe statusBar="light-content">
      <ScrollView
        // removeClippedSubviews={true}
        style={{ backgroundColor }}
        contentContainerStyle={styles.contentContainer}
        ref={scrollViewRef}
        onContentSizeChange={() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd()
          }
        }}
      >
        <MountainHeader
          amount={earnedSats.toString()}
          color={backgroundColor}
          isAvailable
        />
        <View style={styles.mainView}>
          <Finish currSection={currSection} length={sectionsData.length} />
          {SectionsComp}
          {currSection === 0 ? (
            <View style={styles.bottomContainer}>
              <View style={styles.spacingBox}>
                {progress === 0 && <BottomStart height={159} width={BADGER_WIDTH} />}
              </View>
              <View style={styles.bottomSectionInner}>
                <Text style={styles.bottomSectionText}>
                  {LL.EarnScreen.motivatingBadger()}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.position} />
          )}
        </View>
      </ScrollView>

      <CustomModal
        isVisible={showModal}
        toggleModal={() => setShowModal(false)}
        title={LL.EarnScreen.customMessages.oneSectionADay.title()}
        backgroundModalColor={colors.white}
        body={
          <View style={styles.modalBody}>
            <Text style={styles.modalBodyText}>
              {LL.EarnScreen.customMessages.oneSectionADay.message()}
            </Text>
          </View>
        }
        primaryButtonOnPress={continueNotRewards}
        primaryButtonTitle={LL.EarnScreen.continueNoRewards()}
        secondaryButtonTitle={LL.common.close()}
        secondaryButtonOnPress={() => setShowModal(false)}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  contentContainer: {
    backgroundColor: colors._lightBlue,
    flexGrow: 1,
  },
  bottomContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 30,
    height: 200,
    padding: 10,
  },
  spacingBox: {
    height: 159,
    width: BADGER_WIDTH,
  },
  bottomSectionText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
  },
  bottomSectionInner: {
    width: BADGER_WIDTH,
  },
  finishText: {
    color: colors._white,
    fontSize: 18,
    position: "absolute",
    right: 30,
    textAlign: "center",
    top: 30,
    width: 160,
  },
  icon: {
    marginBottom: 6,
    marginHorizontal: 10,
  },
  mainView: {
    alignSelf: "center",
  },
  textStyleBox: {
    color: colors._white,
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 10,
  },
  progressContainer: { backgroundColor: colors._darkGrey, margin: 10 },
  position: { height: 40 },
  loadingView: { flex: 1, justifyContent: "center", alignItems: "center" },
  fullView: { position: "absolute", width: "100%" },
  modalBodyText: {
    fontSize: 17,
    color: colors.black,
    textAlign: "left",
  },
  modalBody: {
    marginTop: 20,
  },
}))
