import { ApolloError } from "@apollo/client";
export var getErrorMessages = function (error) {
    if (Array.isArray(error)) {
        return error.map(function (err) { return err.message; }).join(", ");
    }
    if (error instanceof ApolloError) {
        if (error.graphQLErrors && error.graphQLErrors.length > 0) {
            return error.graphQLErrors.map(function (_a) {
                var message = _a.message;
                return message;
            }).join("\n ");
        }
        return error.message;
    }
    return "Something went wrong";
};
//# sourceMappingURL=utils.js.map