// Stands in for a hook registered by the spec's imports, like RNTL's auto-cleanup: it runs
// after the guard's own afterEach, so its output must not be blamed on the next test.
let finishedTests = 0

afterEach(() => {
  finishedTests += 1
  if (finishedTests === 1) console.warn("warning from the first test's teardown")
})

it("first test", () => {
  expect(true).toBe(true)
})

it("second test", () => {
  expect(true).toBe(true)
})
