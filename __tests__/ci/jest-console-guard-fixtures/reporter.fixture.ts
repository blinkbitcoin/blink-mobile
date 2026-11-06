let flakyAttempts = 0

it("always fails", () => {
  expect(1 + 1).toBe(3)
})

it("fails once, then passes", () => {
  flakyAttempts += 1
  expect(flakyAttempts).toBeGreaterThan(1)
})
