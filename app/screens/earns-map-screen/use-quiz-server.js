var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { gql } from "@apollo/client";
import { useMyQuizQuestionsQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query myQuizQuestions {\n    me {\n      id\n      defaultAccount {\n        id\n        ... on ConsumerAccount {\n          quiz {\n            id\n            amount\n            completed\n            notBefore\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query myQuizQuestions {\n    me {\n      id\n      defaultAccount {\n        id\n        ... on ConsumerAccount {\n          quiz {\n            id\n            amount\n            completed\n            notBefore\n          }\n        }\n      }\n    }\n  }\n"])));
export var useQuizServer = function (_a) {
    var _b, _c;
    var _d = _a === void 0 ? {
        fetchPolicy: "cache-first",
    } : _a, fetchPolicy = _d.fetchPolicy;
    var isAuthed = useIsAuthed();
    var _e = useMyQuizQuestionsQuery({
        fetchPolicy: fetchPolicy,
        skip: !isAuthed,
    }), data = _e.data, loading = _e.loading;
    var quizServerData;
    if (isAuthed) {
        quizServerData = (_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount.quiz.slice()) !== null && _c !== void 0 ? _c : [];
    }
    else {
        quizServerData = [
            {
                __typename: "Quiz",
                id: "whatIsBitcoin",
                amount: 1,
                completed: false,
                notBefore: undefined,
            },
            {
                __typename: "Quiz",
                id: "sat",
                amount: 1,
                completed: false,
                notBefore: undefined,
            },
            {
                __typename: "Quiz",
                id: "whereBitcoinExist",
                amount: 1,
                completed: false,
                notBefore: undefined,
            },
            {
                __typename: "Quiz",
                id: "whoControlsBitcoin",
                amount: 1,
                completed: false,
                notBefore: undefined,
            },
            {
                __typename: "Quiz",
                id: "copyBitcoin",
                amount: 1,
                completed: false,
                notBefore: undefined,
            },
        ];
    }
    var earnedSats = quizServerData
        .filter(function (quiz) { return quiz.completed; })
        .reduce(function (acc, _a) {
        var amount = _a.amount;
        return acc + amount;
    }, 0);
    return { loading: loading, quizServerData: quizServerData, earnedSats: earnedSats };
};
var templateObject_1;
//# sourceMappingURL=use-quiz-server.js.map