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
import { useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { gql } from "@apollo/client";
import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg";
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg";
import { Circle } from "@app/components/circle";
import { IntroducingCirclesModal } from "@app/components/introducing-circles-modal";
import { MayChallengeCard } from "@app/components/may-challenge";
import { useCirclesQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { Screen } from "../../../components/screen";
import { InviteFriendsCard } from "./invite-friends-card";
import { ShareCircles } from "./share-circles-card";
import { JuneChallengeCard } from "@app/components/june-challenge";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query Circles {\n    me {\n      id\n      username\n      defaultAccount {\n        id\n        ... on ConsumerAccount {\n          welcomeProfile {\n            allTimePoints\n            allTimeRank\n            innerCircleAllTimeCount\n            innerCircleThisMonthCount\n            outerCircleAllTimeCount\n            outerCircleThisMonthCount\n            thisMonthPoints\n            thisMonthRank\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query Circles {\n    me {\n      id\n      username\n      defaultAccount {\n        id\n        ... on ConsumerAccount {\n          welcomeProfile {\n            allTimePoints\n            allTimeRank\n            innerCircleAllTimeCount\n            innerCircleThisMonthCount\n            outerCircleAllTimeCount\n            outerCircleThisMonthCount\n            thisMonthPoints\n            thisMonthRank\n          }\n        }\n      }\n    }\n  }\n"])));
export var CirclesDashboardScreen = function () {
    var _a, _b;
    var _c = useTheme().theme, mode = _c.mode, colors = _c.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var _d = useState(false), isIntroducingCirclesModalVisible = _d[0], setIsIntroducingCirclesModalVisible = _d[1];
    var innerCircleRef = useRef(null);
    var outerCircleRef = useRef(null);
    var _e = useState(false), loading = _e[0], setLoading = _e[1];
    var _f = useCirclesQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-first",
    }), data = _f.data, refetchCirclesData = _f.refetch;
    var refetch = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    return [4 /*yield*/, refetchCirclesData()];
                case 1:
                    _c.sent();
                    setLoading(false);
                    (_a = innerCircleRef.current) === null || _a === void 0 ? void 0 : _a.reset();
                    (_b = outerCircleRef.current) === null || _b === void 0 ? void 0 : _b.reset();
                    return [2 /*return*/];
            }
        });
    }); };
    var welcomeProfile = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.welcomeProfile;
    var isLonely = !welcomeProfile || welcomeProfile.innerCircleAllTimeCount === 0;
    var Logo = mode === "dark" ? LogoDarkMode : LogoLightMode;
    return (<Screen>
      <ScrollView contentContainerStyle={styles.scrollView} refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} colors={[colors.primary]} // Android refresh indicator colors
         tintColor={colors.primary} // iOS refresh indicator color
        />}>
        <IntroducingCirclesModal isVisible={isIntroducingCirclesModalVisible} setIsVisible={setIsIntroducingCirclesModalVisible}/>
        <Text type={isLonely ? "p1" : "p2"}>
          {isLonely ? LL.Circles.innerCircleGrow() : LL.Circles.innerCircleExplainer()}
        </Text>
        {!isLonely && (<View style={styles.logoContainer}>
            <Logo height={60}/>
          </View>)}
        {isLonely ? (<View style={styles.groupContainer}>
            <View style={styles.circle}/>
            <Text type="p1" style={styles.groupEffort}>
              {LL.Circles.groupEffort()}
            </Text>
          </View>) : (<View style={styles.circlesContainer}>
            <Circle ref={innerCircleRef} heading={LL.Circles.innerCircle()} value={welcomeProfile.innerCircleAllTimeCount} minValue={1} maxValue={180} description={LL.Circles.peopleYouWelcomed()} subtitle={welcomeProfile.innerCircleThisMonthCount > 0
                ? "+ ".concat(welcomeProfile.innerCircleThisMonthCount, " ").concat(LL.Circles.thisMonth(), "; rank: #").concat(welcomeProfile.thisMonthRank)
                : ""} subtitleGreen bubble countUpDuration={1.8}/>
            <Circle ref={outerCircleRef} heading={LL.Circles.outerCircle()} value={(_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount.welcomeProfile.outerCircleAllTimeCount} minValue={1} maxValue={180} description={LL.Circles.peopleWelcomedByYourCircle()} subtitle={welcomeProfile.outerCircleThisMonthCount > 0
                ? "+ ".concat(welcomeProfile.outerCircleThisMonthCount, " ").concat(LL.Circles.thisMonth())
                : ""} subtitleGreen bubble countUpDuration={1.8}/>
            <Text style={styles.textCenter} type="p2">
              {LL.Circles.yourRankMessage({
                thisMonthRank: welcomeProfile.thisMonthRank,
                allTimeRank: welcomeProfile.allTimeRank,
            })}
            </Text>
          </View>)}
        <MayChallengeCard />
        <JuneChallengeCard />
        {isLonely ? <InviteFriendsCard /> : <ShareCircles />}
      </ScrollView>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return {
        scrollView: {
            padding: 20,
            display: "flex",
            flexDirection: "column",
            rowGap: 25,
        },
        textCenter: {
            textAlign: "center",
        },
        activityIndicator: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            rowGap: 10,
        },
        groupContainer: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "40%",
            marginBottom: "10%",
        },
        groupEffort: {
            textAlign: "center",
            color: colors.grey3,
        },
        circle: {
            position: "absolute",
            height: 150,
            width: 150,
            borderRadius: 75,
            backgroundColor: colors.backdropWhite,
        },
        circlesContainer: {
            zIndex: -1,
            rowGap: 30,
        },
        logoContainer: {
            top: 90,
            left: "60%",
            width: "50%",
            height: "100%",
            position: "absolute",
        },
    };
});
var templateObject_1;
//# sourceMappingURL=circles-dashboard-screen.js.map