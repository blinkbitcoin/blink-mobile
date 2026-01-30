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
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { MockedProvider } from "@apollo/client/testing";
import { MyQuizQuestionsDocument, QuizClaimDocument } from "@app/graphql/generated";
import { createCache } from "@app/graphql/cache";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { EarnQuiz } from "@app/screens/earns-screen/earns-quiz";
import { getQuizQuestionsContent } from "@app/screens/earns-screen/helpers";
import { ContextForScreen } from "./helper";
jest.mock("react-native-modal", function () {
    var MockedModal = function (_a) {
        var isVisible = _a.isVisible, children = _a.children;
        if (!isVisible)
            return null;
        return <>{children}</>;
    };
    return MockedModal;
});
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
var buildRoute = function (params) { return ({
    key: "earnsQuiz",
    name: "earnsQuiz",
    params: params,
}); };
var buildMocks = function (_a) {
    var id = _a.id, skipRewards = _a.skipRewards, errorCode = _a.errorCode;
    var quizClaimResult = jest.fn(function () { return ({
        data: {
            quizClaim: {
                errors: [
                    {
                        message: "Reward wallet empty",
                        code: errorCode,
                    },
                ],
                quizzes: [],
            },
        },
    }); });
    var quizClaimMock = {
        request: {
            query: QuizClaimDocument,
            variables: {
                input: { id: id, skipRewards: skipRewards !== null && skipRewards !== void 0 ? skipRewards : false },
            },
        },
        result: quizClaimResult,
    };
    var myQuizQuestionsMock = {
        request: { query: MyQuizQuestionsDocument },
        result: {
            data: {
                __typename: "Query",
                me: {
                    __typename: "User",
                    id: "user-id",
                    defaultAccount: {
                        __typename: "ConsumerAccount",
                        id: "account-id",
                        quiz: [
                            {
                                __typename: "Quiz",
                                id: id,
                                amount: 100,
                                completed: false,
                                notBefore: null,
                            },
                        ],
                    },
                },
            },
        },
    };
    return {
        mocks: [myQuizQuestionsMock, quizClaimMock],
        quizClaimResult: quizClaimResult,
    };
};
var renderEarnQuiz = function (_a) {
    var routeParams = _a.routeParams, mocks = _a.mocks;
    var route = buildRoute(routeParams);
    return render(<ContextForScreen>
      <MockedProvider mocks={mocks} cache={createCache()} addTypename={true}>
        <EarnQuiz route={route}/>
      </MockedProvider>
    </ContextForScreen>);
};
describe("EarnQuiz", function () {
    var quizId = "whatIsBitcoin";
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("claims with skipRewards when unavailable and does not show no-rewards modal", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, mocks, quizClaimResult, routeParams, _b, getByText, queryByText, answersContent, answersFlat, card, correctAnswerText, correctAnswerNode;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = buildMocks({
                        id: quizId,
                        skipRewards: true,
                        errorCode: "NOT_ENOUGH_BALANCE_FOR_QUIZ",
                    }), mocks = _a.mocks, quizClaimResult = _a.quizClaimResult;
                    routeParams = {
                        id: quizId,
                        isAvailable: false,
                    };
                    _b = renderEarnQuiz({ routeParams: routeParams, mocks: mocks }), getByText = _b.getByText, queryByText = _b.queryByText;
                    answersContent = getQuizQuestionsContent({ LL: LL });
                    answersFlat = answersContent.map(function (item) { return item.content; }).flatMap(function (item) { return item; });
                    card = answersFlat.find(function (item) { return item.id === quizId; });
                    if (!card) {
                        throw new Error("Quiz card not found");
                    }
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(getByText(LL.common.continue()));
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _c.sent();
                    correctAnswerText = card.answers[0];
                    correctAnswerNode = getByText(correctAnswerText);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(findPressableParent(correctAnswerNode));
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(quizClaimResult).toHaveBeenCalledTimes(1);
                        })];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(queryByText(LL.EarnScreen.continueNoRewards())).toBeNull();
                        })];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(queryByText(LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.title())).toBeNull();
                        })];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows no-rewards modal when available and claim returns a skip-reward error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, mocks, quizClaimResult, routeParams, getByText, answersContent, answersFlat, card, earnButtonLabel, correctAnswerText, correctAnswerNode;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = buildMocks({
                        id: quizId,
                        errorCode: "NOT_ENOUGH_BALANCE_FOR_QUIZ",
                    }), mocks = _a.mocks, quizClaimResult = _a.quizClaimResult;
                    routeParams = {
                        id: quizId,
                        isAvailable: true,
                    };
                    getByText = renderEarnQuiz({ routeParams: routeParams, mocks: mocks }).getByText;
                    answersContent = getQuizQuestionsContent({ LL: LL });
                    answersFlat = answersContent.map(function (item) { return item.content; }).flatMap(function (item) { return item; });
                    card = answersFlat.find(function (item) { return item.id === quizId; });
                    if (!card) {
                        throw new Error("Quiz card not found");
                    }
                    earnButtonLabel = LL.EarnScreen.earnSats({
                        formattedNumber: 100,
                    });
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByText(earnButtonLabel)).toBeTruthy();
                        })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(getByText(earnButtonLabel));
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    correctAnswerText = card.answers[0];
                    correctAnswerNode = getByText(correctAnswerText);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(findPressableParent(correctAnswerNode));
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(quizClaimResult).toHaveBeenCalledTimes(1);
                        })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(getByText(LL.EarnScreen.continueNoRewards())).toBeTruthy();
                        })];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=earns-quiz.spec.js.map