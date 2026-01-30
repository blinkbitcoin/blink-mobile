var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
import * as React from "react";
import { useState } from "react";
import { Dimensions, Text, View, Alert } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import Icon from "react-native-vector-icons/Ionicons";
import { PaginationItem } from "@app/components/pagination";
import { useLevel } from "@app/graphql/level-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Button } from "@rn-vui/base";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { useQuizServer } from "../earns-map-screen/use-quiz-server";
import { SVGs } from "./earn-svg-factory";
import { augmentCardWithGqlData, getCardsFromSection, getQuizQuestionsContent, } from "./helpers";
var screenWidth = Dimensions.get("window").width;
var svgWidth = screenWidth;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            alignItems: "center",
            flex: 1,
        },
        buttonStyleDisabled: {
            backgroundColor: colors._white,
            borderRadius: 24,
            marginHorizontal: 60,
            marginVertical: 32,
            opacity: 0.5,
        },
        buttonStyleFulfilled: {
            backgroundColor: colors.transparent,
            borderRadius: 24,
            marginHorizontal: 60,
            marginVertical: 32,
        },
        icon: { paddingRight: 12, paddingTop: 3 },
        item: {
            backgroundColor: colors._lightBlue,
            borderRadius: 16,
            width: svgWidth,
        },
        itemTitle: {
            color: colors._white,
            fontSize: 20,
            fontWeight: "bold",
            height: 72,
            marginHorizontal: 24,
            textAlign: "center",
        },
        svgContainer: { paddingVertical: 12 },
        textButton: {
            backgroundColor: colors._white,
            borderRadius: 24,
            marginHorizontal: 60,
            marginVertical: 32,
        },
        titleStyle: {
            color: colors._lightBlue,
            fontWeight: "bold",
        },
        titleStyleDisabled: {
            color: colors._lightBlue,
        },
        titleStyleFulfilled: {
            color: colors._white,
        },
        unlock: {
            alignSelf: "center",
            color: colors._white,
            fontSize: 16,
            fontWeight: "bold",
            textAlign: "center",
        },
        unlockQuestion: {
            alignSelf: "center",
            color: colors._white,
            fontSize: 16,
            paddingTop: 18,
        },
        paginationContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            width: 100,
            alignSelf: "center",
            position: "absolute",
            bottom: 40,
        },
    });
});
var convertToQuizQuestionForSectionScreen = function (cards) {
    var allPreviousFulfilled = true;
    var nonEnabledMessage = "";
    return cards.map(function (card) {
        var newCard = __assign(__assign({}, card), { enabled: allPreviousFulfilled, nonEnabledMessage: nonEnabledMessage });
        if (!newCard.completed && allPreviousFulfilled) {
            allPreviousFulfilled = false;
            nonEnabledMessage = newCard.title;
        }
        return newCard;
    });
};
export var EarnSection = function (_a) {
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var isAtLeastLevelOne = useLevel().isAtLeastLevelOne;
    var LL = useI18nContext().LL;
    var quizQuestionsContent = getQuizQuestionsContent({ LL: LL });
    var quizServerData = useQuizServer().quizServerData;
    var _b = route.params, section = _b.section, isAvailable = _b.isAvailable;
    var cardsOnSection = getCardsFromSection({
        section: section,
        quizQuestionsContent: quizQuestionsContent,
    });
    var cards = convertToQuizQuestionForSectionScreen(cardsOnSection.map(function (card) { return augmentCardWithGqlData({ card: card, quizServerData: quizServerData }); }));
    var itemIndex = cards.findIndex(function (item) { return !item.completed; });
    var firstItem = useState(itemIndex >= 0 ? itemIndex : 0)[0];
    var progressValue = useSharedValue(0);
    var isCompleted = cards.every(function (item) { return item.completed; });
    var initialIsCompleted = useState(isCompleted)[0];
    var sectionTitle = LL.EarnScreen.earnSections[section].title();
    var isFocused = useIsFocused();
    if (initialIsCompleted === false && isCompleted && isFocused) {
        navigation.navigate("sectionCompleted", {
            amount: cards.reduce(function (acc, item) { return item.amount + acc; }, 0),
            sectionTitle: sectionTitle,
            isAvailable: isAvailable,
        });
    }
    React.useEffect(function () {
        navigation.setOptions({ title: sectionTitle });
    }, [navigation, sectionTitle]);
    var open = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!isAtLeastLevelOne) {
                Alert.alert(LL.EarnScreen.registerTitle(), LL.EarnScreen.registerContent(), [
                    {
                        text: LL.common.cancel(),
                        onPress: function () { return console.log("Cancel Pressed"); },
                        style: "cancel",
                    },
                    {
                        text: "OK",
                        onPress: function () {
                            return navigation.navigate("acceptTermsAndConditions", { flow: "phone" });
                        },
                    },
                ]);
                return [2 /*return*/];
            }
            navigation.navigate("earnsQuiz", { id: id, isAvailable: isAvailable });
            return [2 /*return*/];
        });
    }); };
    var CardItem = function (_a) {
        var item = _a.item;
        return (<>
        <View style={styles.item}>
          <TouchableOpacity onPress={function () { return open(item.id); }} activeOpacity={0.9} disabled={!item.enabled}>
            <View style={styles.svgContainer}>
              {SVGs({ name: item.id, width: svgWidth })}
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.itemTitle} numberOfLines={3}>
              {item.title}
            </Text>
            <Button onPress={function () { return open(item.id); }} disabled={!item.enabled} disabledStyle={styles.buttonStyleDisabled} disabledTitleStyle={styles.titleStyleDisabled} buttonStyle={item.completed ? styles.buttonStyleFulfilled : styles.textButton} titleStyle={item.completed ? styles.titleStyleFulfilled : styles.titleStyle} title={item.completed
                ? isAvailable
                    ? LL.EarnScreen.satsEarned({ formattedNumber: item.amount })
                    : LL.common.correct()
                : isAvailable
                    ? LL.EarnScreen.earnSats({ formattedNumber: item.amount })
                    : LL.common.continue()} icon={item.completed ? (<Icon name="checkmark-circle-outline" size={36} color={colors._white} style={styles.icon}/>) : undefined}/>
          </View>
        </View>
        {!item.enabled && (<>
            <Text style={styles.unlockQuestion}>{LL.EarnScreen.unlockQuestion()}</Text>
            <Text style={styles.unlock}>{item.nonEnabledMessage}</Text>
          </>)}
      </>);
    };
    return (<Screen backgroundColor={colors._blue} statusBar="light-content">
      <View style={styles.container}>
        <Carousel data={cards} renderItem={CardItem} width={screenWidth} style={{ width: screenWidth }} mode="parallax" defaultIndex={firstItem} loop={false} modeConfig={{
            parallaxScrollingScale: 0.82,
            parallaxScrollingOffset: 80,
        }} onProgressChange={progressValue}/>
        {Boolean(progressValue) && (<View style={styles.paginationContainer}>
            {cards.map(function (_, index) {
                return (<PaginationItem backgroundColor={"grey"} animValue={progressValue} index={index} key={index} length={cards.length}/>);
            })}
          </View>)}
      </View>
    </Screen>);
};
//# sourceMappingURL=earns-section.js.map