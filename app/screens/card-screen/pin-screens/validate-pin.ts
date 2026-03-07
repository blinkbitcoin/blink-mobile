const isRepeated = (pin: string): boolean => /^(\d)\1{3}$/.test(pin)

const isSequential = (pin: string): boolean => {
  const digits = pin.split("").map(Number)

  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1)
  if (ascending) return true

  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)
  return descending
}

export const isWeakPin = (pin: string): boolean => isRepeated(pin) || isSequential(pin)
