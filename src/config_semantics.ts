import { Config } from "./types"
import { normalizeSnmpVersion } from "./snmp_version"

export function validateConfigSemantics(config: Config): string[] {
  const errors: string[] = []

  for (let targetIndex = 0; targetIndex < config.targets.length; targetIndex++) {
    const target = config.targets[targetIndex]
    const path = `targets[${targetIndex}] (${target.host})`
    let version: "1" | "2c" | "3"

    try {
      version = normalizeSnmpVersion(target.version)
    } catch (error) {
      errors.push(
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    if (version === "3" && !target.username?.trim()) {
      errors.push(`${path}: SNMPv3 requires username`)
    }

    if (target.auth_protocol && !target.auth_key) {
      errors.push(`${path}: auth_protocol requires auth_key`)
    }

    if (target.priv_key && !target.auth_key) {
      errors.push(`${path}: priv_key requires auth_key`)
    }

    if (target.priv_protocol && !target.priv_key) {
      errors.push(`${path}: priv_protocol requires priv_key`)
    }
  }

  if (config.homeassistant.discovery) {
    const identities = new Map<string, string>()

    for (let targetIndex = 0; targetIndex < config.targets.length; targetIndex++) {
      const target = config.targets[targetIndex]

      for (let sensorIndex = 0; sensorIndex < target.sensors.length; sensorIndex++) {
        const sensor = target.sensors[sensorIndex]
        if (!sensor.object_id) continue

        const objectId = sensor.object_id.trim()
        const path = `targets[${targetIndex}].sensors[${sensorIndex}] (${target.host} / ${sensor.name})`

        if (!objectId) {
          errors.push(`${path}: object_id cannot be empty`)
          continue
        }

        const key = objectId.toLowerCase()
        const previous = identities.get(key)
        if (previous) {
          errors.push(
            `${path}: object_id '${objectId}' collides with ${previous}`,
          )
        } else {
          identities.set(key, path)
        }
      }
    }
  }

  return errors
}
