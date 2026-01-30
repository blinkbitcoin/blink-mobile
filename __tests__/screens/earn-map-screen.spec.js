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
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { EarnMapScreen } from "@app/screens/earns-map-screen";
import { useQuizServer } from "@app/screens/earns-map-screen/use-quiz-server";
import { ContextForScreen } from "./helper";
var mockNavigate = jest.fn();
jest.mock("@react-navigation/native", function () {
    var actual = jest.requireActual("@react-navigation/native");
    return __assign(__assign({}, actual), { useNavigation: function () {
            var _a;
            return (__assign(__assign({}, (_a = actual.useNavigation) === null || _a === void 0 ? void 0 : _a.call(actual)), { navigate: mockNavigate }));
        } });
});
jest.mock("@app/screens/earns-map-screen/use-quiz-server", function () { return ({
    useQuizServer: jest.fn(),
}); });
var findPressableParent = function (node) {
    var _a;
    var current = node;
    while (current && !((_a = current.props) === null || _a === void 0 ? void 0 : _a.onPress)) {
        current = current.parent;
    }
    if (!current) {
        throw new Error("Pressable parent not found");
    }
    return current;
};
describe("EarnMapScreen", function () {
    var mockedUseQuizServer = useQuizServer;
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
        mockNavigate.mockClear();
    });
    it("closes the one-section-per-day modal when continuing without rewards", function () { return __awaiter(void 0, void 0, void 0, function () {
        var futureSeconds, sectionTitle, oneSectionTitle, sectionTitleNode;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    futureSeconds = Math.floor(Date.now() / 1000) + 3600;
                    mockedUseQuizServer.mockReturnValue({
                        loading: false,
                        earnedSats: 5,
                        quizServerData: [
                            {
                                __typename: "Quiz",
                                id: "whatIsBitcoin",
                                amount: 1,
                                completed: true,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "sat",
                                amount: 1,
                                completed: true,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "whereBitcoinExist",
                                amount: 1,
                                completed: true,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "whoControlsBitcoin",
                                amount: 1,
                                completed: true,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "copyBitcoin",
                                amount: 1,
                                completed: true,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "moneySocialAgreement",
                                amount: 1,
                                completed: false,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "coincidenceOfWants",
                                amount: 1,
                                completed: false,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "moneyEvolution",
                                amount: 1,
                                completed: false,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "whyStonesShellGold",
                                amount: 1,
                                completed: false,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "moneyIsImportant",
                                amount: 1,
                                completed: false,
                                notBefore: undefined,
                            },
                            {
                                __typename: "Quiz",
                                id: "moneyImportantGovernement",
                                amount: 1,
                                completed: false,
                                notBefore: futureSeconds,
                            },
                        ],
                    });
                    render(<ContextForScreen>
        <EarnMapScreen />
      </ContextForScreen>);
                    sectionTitle = LL.EarnScreen.earnSections.WhatIsMoney.title();
                    oneSectionTitle = LL.EarnScreen.customMessages.oneSectionADay.title();
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(sectionTitle)).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    sectionTitleNode = screen.getByText(sectionTitle);
                    fireEvent.press(findPressableParent(sectionTitleNode));
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(oneSectionTitle)).toBeTruthy();
                        })];
                case 2:
                    _a.sent();
                    fireEvent.press(screen.getByText(LL.EarnScreen.continueNoRewards()));
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.queryByText(oneSectionTitle)).toBeNull();
                        })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=earn-map-screen.spec.js.map