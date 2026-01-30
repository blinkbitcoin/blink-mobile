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
import { GALOY_INSTANCES } from "@app/config";
var migrate6ToCurrent = function (state) {
    return Promise.resolve(state);
};
var migrate5ToCurrent = function (state) {
    return migrate6ToCurrent(__assign(__assign({}, state), { schemaVersion: 6 }));
};
var migrate4ToCurrent = function (state) {
    var newGaloyInstance = GALOY_INSTANCES.find(function (instance) { return instance.name === state.galoyInstance.name; });
    if (!newGaloyInstance) {
        if (state.galoyInstance.name === "BBW") {
            var newGaloyInstanceTest = GALOY_INSTANCES.find(function (instance) { return instance.name === "Blink"; });
            if (!newGaloyInstanceTest) {
                throw new Error("Galoy instance not found");
            }
        }
    }
    var galoyInstance;
    if (state.galoyInstance.name === "Custom") {
        // we only keep the full object if we are on Custom
        // otherwise data will be stored in GaloyInstancesInput[]
        galoyInstance = __assign(__assign({}, state.galoyInstance), { id: "Custom" });
    }
    else if (state.galoyInstance.name === "BBW" || state.galoyInstance.name === "Blink") {
        // we are using "Main" instead of "BBW", so that the bankName is not hardcoded in the saved json
        galoyInstance = { id: "Main" };
    }
    else {
        galoyInstance = { id: state.galoyInstance.name };
    }
    return migrate5ToCurrent({
        schemaVersion: 5,
        galoyAuthToken: state.galoyAuthToken,
        galoyInstance: galoyInstance,
    });
};
var migrate3ToCurrent = function (state) {
    var newGaloyInstance = GALOY_INSTANCES.find(function (instance) { return instance.name === state.galoyInstance.name; });
    if (!newGaloyInstance) {
        throw new Error("Galoy instance not found");
    }
    return migrate4ToCurrent(__assign(__assign({}, state), { galoyInstance: newGaloyInstance, schemaVersion: 4 }));
};
var stateMigrations = {
    3: migrate3ToCurrent,
    4: migrate4ToCurrent,
    5: migrate5ToCurrent,
    6: migrate6ToCurrent,
};
export var defaultPersistentState = {
    schemaVersion: 6,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "",
};
export var migrateAndGetPersistentState = function (
// TODO: pass the correct type.
// this is especially important given this is migration code and it's hard to test manually
// eslint-disable-next-line @typescript-eslint/no-explicit-any
data) { return __awaiter(void 0, void 0, void 0, function () {
    var schemaVersion, migration, persistentState, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(Boolean(data) && data.schemaVersion in stateMigrations)) return [3 /*break*/, 4];
                schemaVersion = data.schemaVersion;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                migration = stateMigrations[schemaVersion];
                return [4 /*yield*/, migration(data)];
            case 2:
                persistentState = _a.sent();
                if (persistentState) {
                    return [2 /*return*/, persistentState];
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                console.error({ err: err_1 }, "error migrating persistent state");
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/, defaultPersistentState];
        }
    });
}); };
//# sourceMappingURL=state-migrations.js.map