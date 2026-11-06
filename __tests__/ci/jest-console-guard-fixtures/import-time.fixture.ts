// A call at import happens once per file, so CI's retry of the first test cannot repeat it.
console.log("import-time log")

it("only test", () => {
  expect(true).toBe(true)
})
