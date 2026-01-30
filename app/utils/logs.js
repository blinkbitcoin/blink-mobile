import { LogBox } from "react-native";
import Config from "react-native-config";
// Interferes in tests
if (Config.IGNORE_LOGS)
    LogBox.ignoreLogs(["[GraphQL error]:"]);
//# sourceMappingURL=logs.js.map