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
import { earnSections, validateQuizCodeErrors, } from "./sections";
export var getCardsFromSection = function (_a) {
    var section = _a.section, quizQuestionsContent = _a.quizQuestionsContent;
    var quizzes = quizQuestionsContent.find(function (content) { return section === content.section.id; });
    return (quizzes === null || quizzes === void 0 ? void 0 : quizzes.content.map(function (card) { return card; })) || [];
};
export var augmentCardWithGqlData = function (_a) {
    var card = _a.card, quizServerData = _a.quizServerData;
    var myQuiz = quizServerData.find(function (quiz) { return quiz.id === card.id; });
    var notBefore = (myQuiz === null || myQuiz === void 0 ? void 0 : myQuiz.notBefore) ? new Date(myQuiz.notBefore * 1000) : undefined;
    return __assign(__assign({}, card), { amount: (myQuiz === null || myQuiz === void 0 ? void 0 : myQuiz.amount) || 0, completed: (myQuiz === null || myQuiz === void 0 ? void 0 : myQuiz.completed) || false, notBefore: notBefore });
};
export var getQuizQuestionsContent = function (_a) {
    var LL = _a.LL;
    var LLEarn = LL.EarnScreen.earnSections;
    var quizSectionContent = Object.keys(earnSections).map(function (sectionId) { return ({
        section: {
            id: sectionId,
            title: LLEarn[sectionId].title(),
        },
        content: earnSections[sectionId].questions.map(function (question) {
            // we would need more precise type to infer correctly the type here
            // because we are filtering with EarnSectionType, we are only looking through one section
            // at a time. but the questions are from all the types, so typescript
            // cant infer the type correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            var questions = LLEarn[sectionId].questions[question];
            return {
                id: question,
                title: questions.title(),
                text: questions.text(),
                question: questions.question(),
                answers: Object.values(questions.answers).map(
                // need to execute the function to get the value
                function (answer) { return answer(); }),
                feedback: Object.values(questions.feedback).map(
                // need to execute the function to get the value
                function (feedback) { return feedback(); }),
            };
        }),
    }); });
    return quizSectionContent;
};
var shownErrorCodes = new Set();
export var skipRewardErrorCodes = function (code) {
    return Boolean(code) && validateQuizCodeErrors.includes(code);
};
export var errorCodeAlertAlreadyShown = function (code) {
    return Boolean(code) &&
        skipRewardErrorCodes(code) &&
        shownErrorCodes.has(code);
};
export var markErrorCodeAlertAsShown = function (code) {
    if (!code)
        return;
    shownErrorCodes.add(code);
};
//# sourceMappingURL=helpers.js.map