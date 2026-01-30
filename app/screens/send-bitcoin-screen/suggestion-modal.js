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
import * as React from "react";
import { View, TextInput } from "react-native";
import { gql } from "@apollo/client";
import { useFeedbackSubmitMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles, useTheme } from "@rn-vui/themed";
import CustomModal from "../../components/custom-modal/custom-modal";
import { testProps } from "../../utils/testProps";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation feedbackSubmit($input: FeedbackSubmitInput!) {\n    feedbackSubmit(input: $input) {\n      errors {\n        message\n        __typename\n      }\n      success\n      __typename\n    }\n  }\n"], ["\n  mutation feedbackSubmit($input: FeedbackSubmitInput!) {\n    feedbackSubmit(input: $input) {\n      errors {\n        message\n        __typename\n      }\n      success\n      __typename\n    }\n  }\n"])));
export var SuggestionModal = function (_a) {
    var navigation = _a.navigation, showSuggestionModal = _a.showSuggestionModal, setShowSuggestionModal = _a.setShowSuggestionModal;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var _b = React.useState(""), suggestion = _b[0], setSuggestion = _b[1];
    var sendFeedback = useFeedbackSubmitMutation()[0];
    var submitSuggestion = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, sendFeedback({ variables: { input: { feedback: suggestion } } })];
                case 1:
                    _a.sent();
                    setShowSuggestionModal(false);
                    navigation.popToTop();
                    return [2 /*return*/];
            }
        });
    }); };
    var dismissSuggestionModal = function () {
        navigation.popToTop();
        setShowSuggestionModal(false);
    };
    return (<CustomModal title={LL.support.thankYouText()} minHeight={"50%"} titleMaxWidth={"100%"} titleTextAlignment={"left"} toggleModal={dismissSuggestionModal} isVisible={showSuggestionModal} primaryButtonTitle={LL.common.submit()} primaryButtonOnPress={submitSuggestion} primaryButtonDisabled={suggestion === ""} body={<View style={styles.field}>
          <TextInput {...testProps(LL.SendBitcoinScreen.suggestionInput())} style={styles.noteInput} onChangeText={function (improvement) {
                return setSuggestion(improvement);
            }} placeholder={LL.SendBitcoinScreen.suggestionInput()} placeholderTextColor={colors.grey2} value={suggestion} multiline={true} numberOfLines={3} autoFocus/>
        </View>} secondaryButtonTitle={LL.AuthenticationScreen.skip()} secondaryButtonOnPress={dismissSuggestionModal} showCloseIconButton={false}/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        noteInput: {
            color: colors.black,
        },
        field: {
            padding: 10,
            backgroundColor: colors.grey5,
            borderRadius: 10,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=suggestion-modal.js.map