const assert = require("assert")
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
)
const lock = fs.readFileSync(path.join(root, "yarn.lock"), "utf8")

assert.strictEqual(
  Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, "bigint-buffer"),
  false,
  "bigint-buffer must not return to the production dependency set",
)

assert.deepStrictEqual(pkg.resolutions, {
  "brace-expansion": "1.1.18",
  "fast-uri": "3.1.6",
  ws: "7.5.11",
})

for (const [name, version] of Object.entries(pkg.resolutions)) {
  const escaped = name.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(
    `(?:^|\\n)${escaped}@[^\\n]*:\\n  version "${version.replace(/[.*+?^$()|[\]\\]/g, "\\$&")}"(?:\\n|$)`,
  )
  assert(
    pattern.test(lock),
    `yarn.lock must resolve ${name} to security floor ${version}`,
  )
}

assert(
  !/(?:^|\n)bigint-buffer@[^\n]*:/m.test(lock),
  "yarn.lock must not retain bigint-buffer",
)

console.log(
  "Switch Vision SNMP2MQTT Core dependency-security regression: PASS",
)
