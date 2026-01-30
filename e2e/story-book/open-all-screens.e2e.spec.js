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
import { scrollDownOnLeftSideOfScreen } from "e2e/utils";
var clickNavigator = function () { return __awaiter(void 0, void 0, void 0, function () {
    var navigator;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                navigator = $("//*[contains(@text, 'NAVIGATOR')]");
                return [4 /*yield*/, navigator.waitForDisplayed()];
            case 1:
                _a.sent();
                return [4 /*yield*/, navigator.click()];
            case 2:
                _a.sent();
                return [4 /*yield*/, browser.pause(1000)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var clickUpperRightQuadrant = function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, height, width, x, y;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, browser.getWindowRect()];
            case 1:
                _a = _b.sent(), height = _a.height, width = _a.width;
                x = width - width / 4;
                y = height / 4;
                return [2 /*return*/, browser.touchAction({
                        action: "tap",
                        x: x,
                        y: y,
                    })];
        }
    });
}); };
var openAndCloseStory = function (story) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, story.waitForDisplayed()];
            case 1:
                _a.sent();
                return [4 /*yield*/, story.click()];
            case 2:
                _a.sent();
                return [4 /*yield*/, clickUpperRightQuadrant()];
            case 3:
                _a.sent();
                return [4 /*yield*/, browser.pause(2000)];
            case 4:
                _a.sent();
                return [4 /*yield*/, clickNavigator()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var openAllStoriesOnScreen = function (lastSeenStory) { return __awaiter(void 0, void 0, void 0, function () {
    var visibleStories, lastSeenStoryIndex, newStories, _i, newStories_1, story;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, $$("//*[contains(@content-desc,\"Storybook.ListItem\")]")];
            case 1:
                visibleStories = _b.sent();
                return [4 /*yield*/, visibleStories.findIndex(function (story) { return story.elementId === lastSeenStory; })];
            case 2:
                lastSeenStoryIndex = _b.sent();
                newStories = visibleStories.slice(lastSeenStoryIndex + 1);
                _i = 0, newStories_1 = newStories;
                _b.label = 3;
            case 3:
                if (!(_i < newStories_1.length)) return [3 /*break*/, 6];
                story = newStories_1[_i];
                return [4 /*yield*/, openAndCloseStory(story)];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 3];
            case 6: return [2 /*return*/, (_a = newStories[newStories.length - 1]) === null || _a === void 0 ? void 0 : _a.elementId];
        }
    });
}); };
describe("Storybook screens", function () {
    it("should all open", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lastSeenStory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickNavigator()];
                case 1:
                    _a.sent();
                    lastSeenStory = null;
                    _a.label = 2;
                case 2: return [4 /*yield*/, openAllStoriesOnScreen(lastSeenStory)];
                case 3:
                    lastSeenStory = _a.sent();
                    return [4 /*yield*/, scrollDownOnLeftSideOfScreen()];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (lastSeenStory) return [3 /*break*/, 2];
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=open-all-screens.e2e.spec.js.map