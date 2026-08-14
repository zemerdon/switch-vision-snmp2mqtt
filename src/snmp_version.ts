import { VersionConfig } from "./types"

export type NormalizedSnmpVersion = "1" | "2c" | "3"

export function normalizeSnmpVersion(
  version?: VersionConfig,
): NormalizedSnmpVersion {
  if (version === undefined || version === 1 || version === "1") return "1"
  if (version === "2c") return "2c"
  if (version === 3 || version === "3") return "3"

  throw new Error(`Unsupported SNMP version: ${String(version)}`)
}
