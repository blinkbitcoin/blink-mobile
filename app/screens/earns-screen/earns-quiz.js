var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/* eslint-disable react-native/no-inline-styles */
import * as React from "react";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View, TouchableWithoutFeedback, Pressable, } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { useQuizClaimMutation } from "@app/graphql/generated";
import { getErrorMessages } from "@app/graphql/utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@rn-vui/base";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { CloseCross } from "../../components/close-cross";
import { Screen } from "../../components/screen";
import { shuffle } from "../../utils/helper";
import { sleep } from "../../utils/sleep";
import { useQuizServer } from "../earns-map-screen/use-quiz-server";
import { SVGs } from "./earn-svg-factory";
import { augmentCardWithGqlData, errorCodeAlertAlreadyShown, getQuizQuestionsContent, markErrorCodeAlertAsShown, skipRewardErrorCodes, } from "./helpers";
import CustomModal from "@app/components/custom-modal/custom-modal";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
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
    });
});
var mappingLetter = { 0: "A", 1: "B", 2: "C" };
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation quizClaim($input: QuizClaimInput!) {\n    quizClaim(input: $input) {\n      errors {\n        message\n        code\n      }\n      quizzes {\n        id\n        amount\n        completed\n        notBefore\n      }\n    }\n  }\n"], ["\n  mutation quizClaim($input: QuizClaimInput!) {\n    quizClaim(input: $input) {\n      errors {\n        message\n        code\n      }\n      quizzes {\n        id\n        amount\n        completed\n        notBefore\n      }\n    }\n  }\n"])));
export var EarnQuiz = function (_a) {
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var quizQuestionsContent = getQuizQuestionsContent({ LL: LL });
    var navigation = useNavigation();
    var permutation = useState(shuffle([0, 1, 2]))[0];
    var quizServerData = useQuizServer().quizServerData;
    var _b = route.params, id = _b.id, isAvailable = _b.isAvailable;
    var allCards = React.useMemo(function () { return quizQuestionsContent.map(function (item) { return item.content; }).flatMap(function (item) { return item; }); }, [quizQuestionsContent]);
    var cardNoMetadata = React.useMemo(function () { return allCards.find(function (item) { return item.id === id; }); }, [allCards, id]);
    if (!cardNoMetadata) {
        // should never happen
        throw new Error("card not found");
    }
    var card = augmentCardWithGqlData({ card: cardNoMetadata, quizServerData: quizServerData });
    var title = card.title, text = card.text, amount = card.amount, answers = card.answers, feedback = card.feedback, question = card.question, completed = card.completed;
    var _c = useQuizClaimMutation(), quizClaim = _c[0], quizClaimLoading = _c[1].loading;
    var _d = useState(false), quizVisible = _d[0], setQuizVisible = _d[1];
    var _e = useState([]), recordedAnswer = _e[0], setRecordedAnswer = _e[1];
    var _f = useState(false), hasTriedClaim = _f[0], setHasTriedClaim = _f[1];
    var _g = useState(false), showModal = _g[0], setShowModal = _g[1];
    var _h = useState(), quizErrorMessage = _h[0], setQuizErrorMessage = _h[1];
    var _j = useState(), quizErrorCode = _j[0], setQuizErrorCode = _j[1];
    var addRecordedAnswer = function (value) {
        setRecordedAnswer(__spreadArray(__spreadArray([], recordedAnswer, true), [value], false));
    };
    var claimQuizWrapper = React.useCallback(function (params) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, skipRewards, errorCodeToMark, result, errorCode;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _a = params || {}, skipRewards = _a.skipRewards, errorCodeToMark = _a.errorCodeToMark;
                    if (skipRewards) {
                        markErrorCodeAlertAsShown(errorCodeToMark);
                    }
                    return [4 /*yield*/, quizClaim({
                            variables: { input: { id: id, skipRewards: skipRewards } },
                        })];
                case 1:
                    result = _h.sent();
                    errorCode = (_d = (_c = (_b = result.data) === null || _b === void 0 ? void 0 : _b.quizClaim) === null || _c === void 0 ? void 0 : _c.errors[0]) === null || _d === void 0 ? void 0 : _d.code;
                    if (!skipRewardErrorCodes(errorCode) && ((_g = (_f = (_e = result.data) === null || _e === void 0 ? void 0 : _e.quizClaim) === null || _f === void 0 ? void 0 : _f.errors) === null || _g === void 0 ? void 0 : _g.length)) {
                        navigation.goBack();
                        toastShow({
                            message: getErrorMessages(result.data.quizClaim.errors),
                            LL: LL,
                        });
                    }
                    return [2 /*return*/, result];
            }
        });
    }); }, [quizClaim, id, LL, navigation]);
    var getModalErrorMessages = React.useCallback(function (quizErrorCode) {
        switch (quizErrorCode) {
            case "INVALID_PHONE_FOR_QUIZ":
                return {
                    title: LL.EarnScreen.customMessages.invalidPhoneForQuiz.title(),
                    message: LL.EarnScreen.customMessages.invalidPhoneForQuiz.message(),
                };
            case "INVALID_IP_METADATA":
                return {
                    title: LL.EarnScreen.customMessages.invalidIpMetadata.title(),
                    message: LL.EarnScreen.customMessages.invalidIpMetadata.message(),
                };
            case "QUIZ_CLAIMED_TOO_EARLY":
                return {
                    title: LL.EarnScreen.customMessages.claimedTooEarly.title(),
                    message: LL.EarnScreen.customMessages.claimedTooEarly.message(),
                };
            case "NOT_ENOUGH_BALANCE_FOR_QUIZ":
                return {
                    title: LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.title(),
                    message: LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.message(),
                };
            case "INVALID_QUIZ_QUESTION_ID":
                return {
                    title: LL.EarnScreen.customMessages.invalidQuizQuestionId.title(),
                    message: LL.EarnScreen.customMessages.invalidQuizQuestionId.message(),
                };
            default:
                return {
                    title: LL.EarnScreen.somethingNotRight(),
                    message: quizErrorMessage !== null && quizErrorMessage !== void 0 ? quizErrorMessage : LL.EarnScreen.customErrorMessage(),
                };
        }
    }, [LL, quizErrorMessage]);
    var handleClaimWithoutRewards = React.useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, claimQuizWrapper({
                        skipRewards: true,
                        errorCodeToMark: quizErrorCode,
                    })];
                case 1:
                    _a.sent();
                    setShowModal(false);
                    return [2 /*return*/];
            }
        });
    }); }, [claimQuizWrapper, quizErrorCode]);
    var answersShuffled = [];
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var data, errorCode, defaultErrorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (hasTriedClaim)
                            return [2 /*return*/];
                        if (!(recordedAnswer.indexOf(0) !== -1 && !completed && !quizClaimLoading)) return [3 /*break*/, 4];
                        setHasTriedClaim(true);
                        return [4 /*yield*/, claimQuizWrapper({ skipRewards: !isAvailable })];
                    case 1:
                        data = (_d.sent()).data;
                        if (!((_b = (_a = data === null || data === void 0 ? void 0 : data.quizClaim) === null || _a === void 0 ? void 0 : _a.errors) === null || _b === void 0 ? void 0 : _b.length)) return [3 /*break*/, 4];
                        errorCode = (_c = data.quizClaim.errors[0]) === null || _c === void 0 ? void 0 : _c.code;
                        defaultErrorMessage = LL.EarnScreen.defaultErrorMessage({
                            errorMessage: getErrorMessages(data.quizClaim.errors),
                        });
                        if (!isAvailable)
                            return [2 /*return*/];
                        if (!skipRewardErrorCodes(errorCode)) return [3 /*break*/, 4];
                        if (!errorCodeAlertAlreadyShown(errorCode)) return [3 /*break*/, 3];
                        return [4 /*yield*/, claimQuizWrapper({
                                skipRewards: true,
                                errorCodeToMark: errorCode,
                            })];
                    case 2:
                        _d.sent();
                        return [2 /*return*/];
                    case 3:
                        setQuizErrorMessage(defaultErrorMessage);
                        setQuizErrorCode(errorCode);
                        setShowModal(true);
                        _d.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        }); })();
    }, [recordedAnswer, claimQuizWrapper, LL, completed, quizClaimLoading, hasTriedClaim]);
    var closeModal = function () {
        setShowModal(false);
        navigation.navigate("Earn");
    };
    var close = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!quizVisible) return [3 /*break*/, 2];
                    setQuizVisible(false);
                    return [4 /*yield*/, sleep(100)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    navigation.goBack();
                    return [2 /*return*/];
            }
        });
    }); };
    var buttonStyleHelper = function (i) {
        return recordedAnswer.indexOf(i) === -1
            ? styles.quizButtonStyle
            : i === 0
                ? styles.quizCorrectButtonStyle
                : styles.quizWrongButtonStyle;
    };
    var j = 0;
    permutation.forEach(function (i) {
        answersShuffled.push(<View key={i} style={styles.buttonRowWithFeedback}>
        <TouchableOpacity onPress={function () { return addRecordedAnswer(i); }}>
          <View style={styles.buttonRow}>
            <View style={buttonStyleHelper(i)}>
              <Text style={styles.quizButtonTitleStyle}>{mappingLetter[j]}</Text>
            </View>
            <Text style={styles.answerChoiceText}>{answers[i]}</Text>
          </View>
        </TouchableOpacity>
        {recordedAnswer.length > 0 &&
                recordedAnswer.indexOf(i) === recordedAnswer.length - 1 ? (<Text style={i === 0 ? styles.correctAnswerText : styles.incorrectAnswerText}>
            {feedback[i]}
          </Text>) : null}
      </View>);
        j = (j + 1);
    });
    return (<Screen backgroundColor={colors._lighterGrey} unsafe>
      <Modal style={{ marginHorizontal: 0, marginBottom: 0, flexGrow: 1 }} isVisible={quizVisible} swipeDirection={quizVisible ? ["down"] : ["up"]} onSwipeComplete={function () { return setQuizVisible(false); }} swipeThreshold={50} propagateSwipe>
        {/* TODO: expand automatically */}
        <View style={{ flexShrink: 1 }}>
          <TouchableWithoutFeedback onPress={function () { return setQuizVisible(false); }}>
            <View style={{ height: "100%", width: "100%" }}/>
          </TouchableWithoutFeedback>
        </View>
        <View style={styles.modalBackground}>
          <View style={{ height: 14 }}>
            <Icon name="remove" size={72} color={colors._lightGrey} style={{ height: 40, top: -30 }}/>
          </View>
          <ScrollView style={styles.scrollViewStyle} contentContainerStyle={styles.answersView}>
            <Pressable style={styles.answersViewInner}>
              <Text style={styles.title}>{question !== null && question !== void 0 ? question : title}</Text>
              {answersShuffled}
            </Pressable>
          </ScrollView>
          <View>
            {recordedAnswer.indexOf(0) === -1 ? null : (<Button title={LL.EarnScreen.keepDigging()} type="outline" onPress={function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, close()];
        }); }); }} containerStyle={styles.keepDiggingContainerStyle} buttonStyle={styles.buttonStyle} titleStyle={styles.titleStyle}/>)}
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
      <CloseCross onPress={function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, close()];
    }); }); }} color={colors._darkGrey}/>
      <SafeAreaView style={styles.bottomContainer}>
        <View style={{ paddingVertical: 12 }}>
          {(completed && (<>
              <Text style={styles.textEarn}>
                {isAvailable
                ? LL.EarnScreen.quizComplete({ formattedNumber: amount })
                : LL.EarnScreen.sectionsCompleted()}
              </Text>
              <Button title={LL.EarnScreen.reviewQuiz()} type="clear" titleStyle={styles.completedTitleStyle} onPress={function () { return setQuizVisible(true); }}/>
            </>)) || (<Button title={isAvailable
                ? LL.EarnScreen.earnSats({
                    formattedNumber: amount,
                })
                : LL.common.continue()} buttonStyle={styles.buttonStyle} titleStyle={styles.titleStyle} onPress={function () { return setQuizVisible(true); }}/>)}
        </View>
      </SafeAreaView>
      <CustomModal isVisible={showModal} toggleModal={closeModal} title={getModalErrorMessages(quizErrorCode).title} backgroundModalColor={colors.white} body={<View style={styles.modalBody}>
            <Text style={styles.modalBodyText}>
              {getModalErrorMessages(quizErrorCode).message}
            </Text>
          </View>} primaryButtonOnPress={handleClaimWithoutRewards} primaryButtonTitle={LL.EarnScreen.continueNoRewards()} secondaryButtonTitle={LL.common.close()} secondaryButtonOnPress={closeModal}/>
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=earns-quiz.js.map