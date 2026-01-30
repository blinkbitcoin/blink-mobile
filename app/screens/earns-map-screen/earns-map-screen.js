import * as React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { MountainHeader } from "../../components/mountain-header";
import { Screen } from "../../components/screen";
import { augmentCardWithGqlData, getCardsFromSection, getQuizQuestionsContent, } from "../earns-screen";
import { earnSections } from "../earns-screen/sections";
import BitcoinCircle from "./bitcoin-circle-01.svg";
import BottomStart from "./bottom-start-01.svg";
import LeftFinish from "./left-finished-01.svg";
import LeftLastOngoing from "./left-last-section-ongoing-01.svg";
import LeftLastTodo from "./left-last-section-to-do-01.svg";
import LeftComplete from "./left-section-completed-01.svg";
import LeftOngoing from "./left-section-ongoing-01.svg";
import LeftTodo from "./left-section-to-do-01.svg";
import RightFinish from "./right-finished-01.svg";
import RightFirst from "./right-first-section-to-do-01.svg";
import RightLastOngoing from "./right-last-section-ongoing-01.svg";
import RightLastTodo from "./right-last-section-to-do-01.svg";
import RightComplete from "./right-section-completed-01.svg";
import RightOngoing from "./right-section-ongoing-01.svg";
import RightTodo from "./right-section-to-do-01.svg";
import TextBlock from "./text-block-medium.svg";
import { useQuizServer } from "./use-quiz-server";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { useState } from "react";
var BADGER_WIDTH = 134;
var ProgressBar = function (_a) {
    var progress = _a.progress;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var balanceWidth = Number("".concat(progress * 100));
    return (<View style={styles.progressContainer}>
      {/* pass props to style object to remove inline style */}
      {/* eslint-disable react-native/no-inline-styles */}
      <View style={{ width: "".concat(balanceWidth, "%"), height: 3, backgroundColor: colors._white }}/>
      {/* eslint-enable react-native/no-inline-styles */}
    </View>);
};
export var EarnMapScreen = function () {
    var _a, _b;
    var colors = useTheme().theme.colors;
    var navigation = useNavigation();
    var LL = useI18nContext().LL;
    var quizQuestionsContent = getQuizQuestionsContent({ LL: LL });
    var sections = Object.keys(earnSections);
    var sectionsData = sections.map(function (section) { return ({
        index: section,
        text: LL.EarnScreen.earnSections[section].title(),
        icon: BitcoinCircle,
    }); });
    var styles = useStyles();
    var currSection = 0;
    var progress = NaN;
    var _c = useState(false), showModal = _c[0], setShowModal = _c[1];
    var _d = useState(false), notRewards = _d[0], setNotRewards = _d[1];
    var _e = useState(sections[0]), selectedSection = _e[0], setSelectedSection = _e[1];
    var _f = useQuizServer({
        fetchPolicy: "network-only",
    }), loading = _f.loading, quizServerData = _f.quizServerData, earnedSats = _f.earnedSats;
    var canDoNextSection;
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        var cardsOnSection = getCardsFromSection({
            section: section,
            quizQuestionsContent: quizQuestionsContent,
        });
        var cards = cardsOnSection.map(function (card) {
            return augmentCardWithGqlData({ card: card, quizServerData: quizServerData });
        });
        var sectionCompleted = (_a = cards === null || cards === void 0 ? void 0 : cards.every(function (item) { return item === null || item === void 0 ? void 0 : item.completed; })) !== null && _a !== void 0 ? _a : false;
        if (sectionCompleted) {
            currSection += 1;
        }
        else if (isNaN(progress)) {
            // get progress of the current section
            progress = (cards === null || cards === void 0 ? void 0 : cards.filter(function (item) { return item === null || item === void 0 ? void 0 : item.completed; }).length) / cards.length || 0;
            var notBefore = (_b = cards[cards.length - 1]) === null || _b === void 0 ? void 0 : _b.notBefore;
            canDoNextSection = !notBefore || new Date() > notBefore;
        }
    }
    var Finish = function (_a) {
        var currSection = _a.currSection, length = _a.length;
        if (currSection !== sectionsData.length)
            return null;
        return (<>
        <Text style={styles.finishText}>{LL.EarnScreen.finishText()}</Text>
        {length % 2 ? <LeftFinish /> : <RightFinish />}
      </>);
    };
    var InBetweenTile = function (_a) {
        var side = _a.side, position = _a.position, length = _a.length;
        if (currSection < position) {
            if (position === length - 1) {
                return side === "left" ? <LeftLastTodo /> : <RightLastTodo />;
            }
            return side === "left" ? <LeftTodo /> : <RightTodo />;
        }
        if (currSection === position) {
            if (position === length - 1) {
                return (<>
            <View style={styles.position}/>
            {side === "left" ? <LeftLastOngoing /> : <RightLastOngoing />}
          </>);
            }
            if (position === 0 && progress === 0) {
                return <RightFirst />;
            }
            return side === "left" ? <LeftOngoing /> : <RightOngoing />;
        }
        return side === "left" ? <LeftComplete /> : <RightComplete />;
    };
    var BoxAdding = function (_a) {
        var section = _a.section, text = _a.text, Icon = _a.Icon, side = _a.side, position = _a.position, length = _a.length;
        var styles = useStyles();
        var disabled = currSection < position;
        var nextSectionNotYetAvailable = currSection === position && !canDoNextSection;
        var progressSection = disabled ? 0 : currSection > position ? 1 : progress;
        var onPress = function () {
            if (nextSectionNotYetAvailable) {
                setSelectedSection(section);
                if (notRewards) {
                    navigation.navigate("earnsSection", {
                        section: section,
                        isAvailable: false,
                    });
                    return;
                }
                setShowModal(true);
                return;
            }
            navigation.navigate("earnsSection", {
                section: section,
                isAvailable: true,
            });
        };
        // rework this to pass props into the style object
        var boxStyle = StyleSheet.create({
            container: {
                position: "absolute",
                bottom: currSection === position ? (currSection === 0 && progress === 0 ? 30 : 80) : 30,
                left: side === "left" ? 35 : 200,
                opacity: disabled ? 0.5 : 1,
            },
        });
        return (<View>
        <InBetweenTile side={side} position={position} length={length}/>

        <View style={boxStyle.container}>
          <View>
            <TouchableOpacity disabled={disabled} onPress={onPress}>
              <TextBlock />
              <View style={styles.fullView}>
                <ProgressBar progress={progressSection}/>
                <Icon style={styles.icon} width={50} height={50}/>
                <Text style={styles.textStyleBox}>{text}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>);
    };
    var SectionsComp = sectionsData
        .map(function (item, index) { return (<BoxAdding key={item.index} section={item.index} text={item.text} Icon={item.icon} side={index % 2 ? "left" : "right"} position={index} length={sectionsData.length}/>); })
        .reverse();
    var scrollViewRef = React.useRef(null);
    React.useEffect(function () {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd();
        }
    }, []);
    if (loading) {
        return (<Screen>
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={colors._blue}/>
        </View>
      </Screen>);
    }
    var backgroundColor = currSection < sectionsData.length ? colors._sky : colors._orange;
    var continueNotRewards = function () {
        setNotRewards(true);
        setShowModal(false);
        navigation.navigate("earnsSection", {
            section: selectedSection,
            isAvailable: false,
        });
    };
    return (<Screen unsafe statusBar="light-content">
      <ScrollView 
    // removeClippedSubviews={true}
    style={{ backgroundColor: backgroundColor }} contentContainerStyle={styles.contentContainer} ref={scrollViewRef} onContentSizeChange={function () {
            if (scrollViewRef.current) {
                scrollViewRef.current.scrollToEnd();
            }
        }}>
        <MountainHeader amount={earnedSats.toString()} color={backgroundColor} isAvailable/>
        <View style={styles.mainView}>
          <Finish currSection={currSection} length={sectionsData.length}/>
          {SectionsComp}
          {currSection === 0 ? (<View style={styles.bottomContainer}>
              <View style={styles.spacingBox}>
                {progress === 0 && <BottomStart height={159} width={BADGER_WIDTH}/>}
              </View>
              <View style={styles.bottomSectionInner}>
                <Text style={styles.bottomSectionText}>
                  {LL.EarnScreen.motivatingBadger()}
                </Text>
              </View>
            </View>) : (<View style={styles.position}/>)}
        </View>
      </ScrollView>

      <CustomModal isVisible={showModal} toggleModal={function () { return setShowModal(false); }} title={LL.EarnScreen.customMessages.oneSectionADay.title()} backgroundModalColor={colors.white} body={<View style={styles.modalBody}>
            <Text style={styles.modalBodyText}>
              {LL.EarnScreen.customMessages.oneSectionADay.message()}
            </Text>
          </View>} primaryButtonOnPress={continueNotRewards} primaryButtonTitle={LL.EarnScreen.continueNoRewards()} secondaryButtonTitle={LL.common.close()} secondaryButtonOnPress={function () { return setShowModal(false); }}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
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
    });
});
//# sourceMappingURL=earns-map-screen.js.map