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
import { forwardRef, useMemo, useRef } from "react";
import { View, Share as NativeShare } from "react-native";
import { LinearGradient } from "react-native-linear-gradient";
import Share from "react-native-share";
import { captureRef } from "react-native-view-shot";
import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg";
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg";
import { Circle } from "@app/components/circle";
import { getInviteLink } from "@app/config/appinfo";
import { useCirclesQuery } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import theme from "@app/rne-theme/theme";
import crashlytics from "@react-native-firebase/crashlytics";
import { makeStyles, Text, ThemeProvider, useTheme } from "@rn-vui/themed";
export var useCirclesCard = function () {
    var _a, _b;
    var shareImgRef = useRef(null);
    var LL = useI18nContext().LL;
    var data = useCirclesQuery().data;
    var username = ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) || "";
    var welcomeProfile = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount.welcomeProfile;
    var ShareImg = useMemo(function () {
        if (welcomeProfile)
            return (<ThemeProvider theme={__assign(__assign({}, theme), { mode: "dark" })}>
          <ShareImageComponent ref={shareImgRef} username={username} welcomeProfile={welcomeProfile}/>
        </ThemeProvider>);
        return <></>;
    }, [username, welcomeProfile]);
    var share = function () { return __awaiter(void 0, void 0, void 0, function () {
        var inviteLink, uri, shareName, shareOptions, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    if (!(!welcomeProfile || (welcomeProfile === null || welcomeProfile === void 0 ? void 0 : welcomeProfile.innerCircleAllTimeCount) === 0)) return [3 /*break*/, 2];
                    inviteLink = getInviteLink((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username);
                    return [4 /*yield*/, NativeShare.share({ message: inviteLink })];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
                case 2:
                    if (!shareImgRef.current)
                        return [2 /*return*/];
                    return [4 /*yield*/, captureRef(shareImgRef.current, {
                            format: "jpg",
                            quality: 1.0,
                        })];
                case 3:
                    uri = _b.sent();
                    shareName = "".concat(LL.Circles.someones({
                        username: username,
                    }), " ").concat(LL.Circles.titleBlinkCircles());
                    shareOptions = {
                        fileName: shareName,
                        title: shareName,
                        url: uri,
                        type: "image/jpeg",
                        message: "".concat(LL.Circles.drivingAdoption(), " #blinkcircles @blinkbtc"),
                    };
                    return [4 /*yield*/, Share.open(shareOptions)];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _b.sent();
                    crashlytics().log("User didn't share");
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return { ShareImg: ShareImg, share: share };
};
var ShareImageComponent = 
// eslint-disable-next-line react/display-name
forwardRef(function (_a, ref) {
    var username = _a.username, welcomeProfile = _a.welcomeProfile;
    var styles = useStyles();
    var _b = useTheme().theme, colors = _b.colors, mode = _b.mode;
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var lnAddressHostname = appConfig.galoyInstance.lnAddressHostname;
    var lnAddress = "".concat(username, "@").concat(lnAddressHostname);
    var Logo = mode === "dark" ? LogoDarkMode : LogoLightMode;
    return (<View ref={ref} style={styles.shareContainer}>
        <Logo style={styles.logo} height={60}/>
        <View style={styles.usernameContainer}>
          <LinearGradient style={styles.usernameContainerGrad} colors={["#FB5607", "#FFBE0B"]} useAngle={true} angle={190} angleCenter={{ x: 0.5, y: 0.5 }}>
            <Text type="h1" style={styles.boldText} color={colors.white}>
              {LL.Circles.myBlinkCircles()}
            </Text>
            <Text type="p2" color={colors.white}>
              {lnAddress}
            </Text>
          </LinearGradient>
        </View>
        <Text type="p2" style={styles.description}>
          {LL.Circles.innerCircleExplainerCard()}
        </Text>
        <Circle heading={LL.Circles.innerCircle()} value={welcomeProfile.innerCircleAllTimeCount} minValue={1} maxValue={180} description={LL.Circles.peopleIWelcomed()} subtitle={welcomeProfile.innerCircleThisMonthCount > 0
            ? "+ ".concat(welcomeProfile.innerCircleThisMonthCount, " ").concat(LL.Circles.thisMonth())
            : ""} subtitleGreen bubble countUpDuration={0}/>
        <Circle heading={LL.Circles.outerCircle()} value={welcomeProfile.outerCircleAllTimeCount} minValue={1} maxValue={180} description={LL.Circles.peopleWelcomedByMyCircle()} subtitle={welcomeProfile.outerCircleThisMonthCount > 0
            ? "+ ".concat(welcomeProfile.outerCircleThisMonthCount, " ").concat(LL.Circles.thisMonth())
            : ""} subtitleGreen bubble countUpDuration={0}/>
        <Text style={styles.rankText} type="p3" bold>
          {LL.Circles.rankMessage({
            thisMonthRank: welcomeProfile.thisMonthRank,
            allTimeRank: welcomeProfile.allTimeRank,
        })}
        </Text>
        <View style={styles.buildUrCircle}>
          <Text type="p2">{LL.Circles.buildYourCircle()} </Text>
          <Text type="p1" style={styles.boldText} color={colors.primary}>
            get.blink.sv
          </Text>
        </View>
      </View>);
});
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        shareContainer: {
            top: -10000,
            left: -10000,
            // Enable these and disable top two to debug view
            // top: 0,
            // left: "10%",
            // borderWidth: 1,
            // borderColor: colors.red,
            // zIndex: 5,
            // transform: [
            //   {
            //     scale: 0.8,
            //   },
            // ],
            height: 480,
            width: (480 * 3) / 4,
            backgroundColor: colors._black,
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            rowGap: 18,
            justifyContent: "center",
            paddingTop: 100,
            overflow: "hidden",
        },
        buildUrCircle: {
            marginTop: 10,
            paddingHorizontal: 40,
        },
        logo: {
            position: "absolute",
            padding: 80,
            right: 0,
            bottom: -35,
        },
        usernameContainer: {
            position: "absolute",
            minWidth: "80%",
            top: 0,
            // left: -12,
            zIndex: 20,
        },
        usernameContainerGrad: {
            paddingHorizontal: 28,
            paddingVertical: 18,
            borderBottomRightRadius: 40,
        },
        description: {
            position: "absolute",
            top: 120,
            right: 20,
            width: 120,
            textAlign: "left",
            color: colors.grey3,
        },
        boldText: { fontWeight: "700" },
        rankText: {
            paddingHorizontal: 40,
        },
    });
});
//# sourceMappingURL=use-circles-card.js.map