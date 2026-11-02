let warned = false

const warnOnce = () => {
  if (warned) return
  warned = true
  console.warn("warn-once warning")
}

it("warns once", () => {
  warnOnce()
})
