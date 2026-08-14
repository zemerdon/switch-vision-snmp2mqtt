const AjvModule = require("ajv")
const Ajv = AjvModule.default || AjvModule
const { schema } = require("../dist/config_schema")

const ajv = new Ajv({
  allowUnionTypes: true,
  useDefaults: true,
  allErrors: true,
})

const validate = ajv.compile(schema)

const fixture = () => ({
  mqtt: {
    host: "mqtt.example.invalid",
    retain: true,
    qos: 0,
    clean: true,
  },
  homeassistant: {
    discovery: true,
    prefix: "homeassistant",
  },
  targets: [
    {
      host: "192.0.2.10",
      community: "readonly",
      version: "2c",
      sensors: [
        {
          name: "Port 1 Link",
          object_id: "sw1_port_1_link",
          oid: "1.3.6.1.2.1.2.2.1.8.1",
          binary_sensor: true,
        },
      ],
    },
  ],
})

if (!validate(fixture())) {
  console.error(validate.errors)
  throw new Error("Valid object_id fixture should validate")
}

const unknownSensorField = fixture()
unknownSensorField.targets[0].sensors[0].unexpected_switch_vision_field = true
if (validate(unknownSensorField)) {
  throw new Error("Unknown sensor property should still be rejected")
}

for (const version of [1, "1", "2c", 3, "3"]) {
  const config = fixture()
  config.targets[0].version = version
  if (!validate(config)) {
    console.error(validate.errors)
    throw new Error(`Valid SNMP version rejected: ${String(version)}`)
  }
}

for (const version of [2, "2", "v2c", 4, null]) {
  const config = fixture()
  config.targets[0].version = version
  if (validate(config)) {
    throw new Error(`Invalid SNMP version accepted by schema: ${String(version)}`)
  }
}

for (const staleField of ["user", "level"]) {
  const config = fixture()
  config.targets[0][staleField] = "legacy"
  if (validate(config)) {
    throw new Error(`Stale SNMPv3 field '${staleField}' should be rejected`)
  }
}

console.log("Switch Vision SNMP2MQTT config-schema regression: PASS")
