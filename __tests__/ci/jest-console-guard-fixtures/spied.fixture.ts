it("expects its own warning", () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

  console.warn("expected warning")

  expect(warnSpy).toHaveBeenCalledWith("expected warning")
  warnSpy.mockRestore()
})
