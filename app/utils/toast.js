import Toast from "react-native-toast-message";
import { i18nObject } from "@app/i18n/i18n-util";
import { logToastShown } from "./analytics";
export var toastShow = function (_a) {
    var message = _a.message, LL = _a.LL, onHide = _a.onHide, _b = _a.type, type = _b === void 0 ? "error" : _b, autoHide = _a.autoHide;
    var englishTranslation = i18nObject("en");
    var englishMessage = typeof message === "function" ? message(englishTranslation) : message;
    var translatedMessage = typeof message === "function" ? message(LL) : message;
    logToastShown({
        message: englishMessage,
        type: type,
        isTranslated: translatedMessage !== englishMessage,
    });
    // FIXME: Toast might not be shown if there is a modal already,
    // like in the case of the quiz rewards questions
    //
    // a potential solution:
    // https://github.com/calintamas/react-native-toast-message/issues/164#issuecomment-803556361
    Toast.show({
        type: type,
        text1: type === "error" ? LL.common.error() : LL.common.success(),
        text2: translatedMessage,
        position: "bottom",
        bottomOffset: 80,
        onHide: onHide,
        visibilityTime: 4000,
        autoHide: autoHide,
    });
};
//# sourceMappingURL=toast.js.map