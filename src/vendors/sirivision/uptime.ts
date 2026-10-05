export const SIRIVISION_UPTIME_OIDS = {
  snmpEngineTime: "1.3.6.1.6.3.10.2.1.3.0",
  sysOrLastChange: "1.3.6.1.2.1.1.8.0",
} as const

const finiteNonNegativeInteger = (value: unknown, label: string): number => {
  const numeric =
    typeof value === "bigint" ? Number(value) : Number(value as any)
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid ${label} value for Sirivision uptime`)
  }
  return numeric
}

/**
 * The SR-S25G3420F field agent can reset sysUpTime without a chassis reboot.
 * Admitted real-hardware captures show that, on this exact model, chassis
 * uptime is reconstructed by adding snmpEngineTime (seconds) to the
 * sysORLastChange offset (TimeTicks / hundredths of a second).
 *
 * Keep this exact-model helper vendor-scoped; it is not a generic SNMP rule.
 */
export const sirivisionUptimeTicks = (
  snmpEngineTime: unknown,
  sysOrLastChange: unknown,
): number => {
  const engineSeconds = finiteNonNegativeInteger(
    snmpEngineTime,
    "snmpEngineTime",
  )
  const lastChangeTicks = finiteNonNegativeInteger(
    sysOrLastChange,
    "sysORLastChange",
  )
  const ticks = engineSeconds * 100 + lastChangeTicks
  if (!Number.isSafeInteger(ticks)) {
    throw new Error("Sirivision uptime exceeds safe integer range")
  }
  return ticks
}
