/**
 * A "modern" sleep statement.
 *
 * @param ms The number of milliseconds to wait.
 */
export var sleep = function (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
};
//# sourceMappingURL=sleep.js.map