import * as snmp from "net-snmp"

export type SnmpTable = Map<string, string | number>

const parseIndex = (oid: string, baseOid: string): string => {
  const prefix = `${baseOid}.`
  return oid.startsWith(prefix) ? oid.slice(prefix.length) : ""
}

const valueToString = (value: unknown): string => {
  if (Buffer.isBuffer(value)) return value.toString()
  return String(value ?? "")
}

export const walkTable = (session: any, oid: string): Promise<SnmpTable> =>
  new Promise((resolve, reject) => {
    const values: SnmpTable = new Map()

    session.subtree(
      oid,
      20,
      (varbinds: Array<{ oid: string; value: unknown }>) => {
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) continue
          const index = parseIndex(varbind.oid, oid)
          if (!index) continue
          values.set(
            index,
            Buffer.isBuffer(varbind.value)
              ? valueToString(varbind.value)
              : (varbind.value as string | number),
          )
        }
      },
      (error: Error | null) => {
        if (error) reject(error)
        else resolve(values)
      },
    )
  })
