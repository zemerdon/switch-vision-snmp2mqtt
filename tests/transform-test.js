const { evaluateTransform } = require("../dist/transform")

const expect = (expression, value, expected) => {
  const actual = evaluateTransform(expression, value)
  if (actual !== expected) {
    throw new Error(
      `Transform '${expression}' returned ${String(actual)}, expected ${String(expected)}`,
    )
  }
}

expect("value / 6000", 12000, 2)
expect("100 - value", 25, 75)
expect("Math.floor(value / 6000 / 60 / 24)", 33696000, 3)
expect("Math.max(value, 10)", 4, 10)
expect("Math.log(value)", Math.E, 1)
expect("Math.hypot(value, 4)", 3, 5)
expect("value > 5 ? 1 : 0", 6, 1)
expect("value === 1", 1, true)
expect("2 ** 3 ** 2", 0, 512)
expect("Math.floor(value)", "3.8", 3)

const forbidden = [
  "process.exit()",
  "globalThis.process",
  "value.constructor",
  'Function("return process")()',
  "value = 4",
  "Math.constructor",
  "Math.constructor()",
  "Math.__proto__()",
  "Math.toString()",
  "Math.random()",
  "value; 1",
  "this",
  'require("fs")',
  'Math["floor"](value)',
  "value.__proto__",
]

for (const expression of forbidden) {
  let rejected = false
  try {
    evaluateTransform(expression, 1)
  } catch {
    rejected = true
  }
  if (!rejected) {
    throw new Error(`Unsafe transform was accepted: ${expression}`)
  }
}

let oversizedRejected = false
try {
  evaluateTransform(`value${" + 1".repeat(200)}`, 1)
} catch {
  oversizedRejected = true
}
if (!oversizedRejected) throw new Error("Oversized transform was accepted")

console.log("Switch Vision SNMP2MQTT safe-transform regression: PASS")
