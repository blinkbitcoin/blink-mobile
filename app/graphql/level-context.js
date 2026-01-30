import { createContext, useContext } from "react";
export var AccountLevel = {
    NonAuth: "NonAuth",
    Zero: "ZERO",
    One: "ONE",
    Two: "TWO",
    Three: "THREE",
};
var Level = createContext({
    isAtLeastLevelZero: false,
    isAtLeastLevelOne: false,
    isAtLeastLevelTwo: false,
    isAtLeastLevelThree: false,
    currentLevel: AccountLevel.NonAuth,
});
export var LevelContextProvider = Level.Provider;
export var useLevel = function () { return useContext(Level); };
//# sourceMappingURL=level-context.js.map