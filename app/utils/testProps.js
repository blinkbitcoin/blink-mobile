// This is used for E2E tests to apply id's to a <Component/>
// Usage:
//  <Button {...testProps("testID")} />
export var testProps = function (testID) {
    return {
        testID: testID,
        accessible: true,
        accessibilityLabel: testID,
    };
};
//# sourceMappingURL=testProps.js.map