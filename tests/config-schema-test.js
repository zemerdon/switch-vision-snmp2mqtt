const AjvModule = require("ajv")
const Ajv = AjvModule.default || AjvModule
const { schema } = require("../dist/config_schema")

const ajv = new Ajv({
  allowUnionTypes: true,
  useDefaults: true,
  allErrors: true,
})

const validate = ajv.compile(schema)

const valid = {
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
}

if (!validate(valid)) {
  console.error(validate.errors)
  throw new Error("object_id fixture should validate")
}

const invalid = JSON.parse(JSON.stringify(valid))
invalid.targets[0].sensors[0].unexpected_switch_vision_field = true

if (validate(invalid)) {
  throw new Error("unknown sensor property should still be rejected")
}

console.log("Switch Vision SNMP2MQTT config-schema regression: PASS")
