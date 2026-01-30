import { Platform } from "react-native";
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export var shuffle = function (array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;
    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
};
// Shorten a long text by inserting "..." in the middle, keeping the ends visible.
export var ellipsizeMiddle = function (text, options) {
    if (options === void 0) { options = {
        maxLength: 50,
        maxResultLeft: 13,
        maxResultRight: 8,
    }; }
    var maxLength = options.maxLength, maxResultLeft = options.maxResultLeft, maxResultRight = options.maxResultRight;
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxResultLeft) + "..." + text.slice(text.length - maxResultRight);
};
export var isIos = Platform.OS === "ios";
export var normalizeString = function (value) { return (value !== null && value !== void 0 ? value : "").trim().toLowerCase(); };
//# sourceMappingURL=helper.js.map