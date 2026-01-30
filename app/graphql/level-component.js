var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import * as React from "react";
import { gql } from "@apollo/client";
import { useLevelQuery } from "./generated";
import { useIsAuthed } from "./is-authed-context";
import { LevelContextProvider } from "./level-context";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query network {\n    globals {\n      network\n    }\n  }\n\n  query level {\n    me {\n      id\n      defaultAccount {\n        id\n        level\n      }\n    }\n  }\n"], ["\n  query network {\n    globals {\n      network\n    }\n  }\n\n  query level {\n    me {\n      id\n      defaultAccount {\n        id\n        level\n      }\n    }\n  }\n"])));
export var LevelContainer = function (_a) {
    var _b, _c;
    var children = _a.children;
    var isAuthed = useIsAuthed();
    var isAtLeastLevelZero = isAuthed;
    var data = useLevelQuery({ fetchPolicy: "cache-only" }).data;
    var level = (_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.level;
    var isAtLeastLevelOne = level === "ONE" || level === "TWO" || level === "THREE";
    var isAtLeastLevelTwo = level === "TWO" || level === "THREE";
    var isAtLeastLevelThree = level === "THREE";
    var currentLevel = isAuthed && level ? level : "NonAuth";
    return (<LevelContextProvider value={{
            isAtLeastLevelZero: isAtLeastLevelZero,
            isAtLeastLevelOne: isAtLeastLevelOne,
            isAtLeastLevelTwo: isAtLeastLevelTwo,
            isAtLeastLevelThree: isAtLeastLevelThree,
            currentLevel: currentLevel,
        }}>
      {children}
    </LevelContextProvider>);
};
var templateObject_1;
//# sourceMappingURL=level-component.js.map