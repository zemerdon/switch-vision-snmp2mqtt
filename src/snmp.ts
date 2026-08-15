import * as snmp from "net-snmp"

import {
  InterfaceAttribute,
  SensorConfig,
  TargetConfig,
  VersionConfig,
} from "./types"
import { normalizeSnmpVersion } from "./snmp_version"
import { evaluateTransform } from "./transform"
import { EventEmitter } from "events"
import { Logger } from "./log"
import { toBigIntBE } from "bigint-buffer"
import {
  collectJuniperVlanPortStates,
  juniperVlanAttributeValue,
} from "./vendors/juniper/vlan"
import {
  IF_NAME_OID,
  interfaceCandidates,
  interfaceOid,
  resolveInterfaceIndex,
} from "./interface"
import { SnmpTable, walkTable } from "./snmp_table"
import { SensorUnavailableError } from "./sensor_error"

const versionToNetSnmp = (version?: VersionConfig) => {
  switch (normalizeSnmpVersion(version)) {
    case "1":
      return snmp.Version1 as number
    case "2c":
      return snmp.Version2c as number
    case "3":
      return snmp.Version3 as number
  }
}

export declare interface Target {
  on(
    event: "response",
    listener: (
      values: Array<string | number | bigint | boolean>,
      target: TargetConfig,
    ) => void,
  ): this
}

export class Target extends EventEmitter {
  private session: any
  private interval?: NodeJS.Timeout
  private ending: boolean = false
  private fetching: boolean = false

  public constructor(
    private options: TargetConfig,
    private log: Logger,
  ) {
    super()
  }

  public pause() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }

  public resume() {
    // Prevent duplicate timers when MQTT reconnects or resume is called twice.
    if (this.interval) {
      clearInterval(this.interval)
    }

    // Poll once immediately, then continue on the configured interval.
    this.fetch()

    this.interval = setInterval(() => {
      this.fetch()
    }, this.getScanInterval())
  }

  public end() {
    this.ending = true

    return new Promise<void>((res) => {
      this.session.on("close", () => {
        res()
      })
      this.session.close()
    })
  }

  private getScanInterval() {
    return (this.options.scan_interval ?? 10) * 1000
  }

  public connect() {
    const scanIntervalMs = this.getScanInterval()

    const options: any = {
      port: this.options.port ?? 161,
      retries: 3,
      timeout: scanIntervalMs > 5000 ? 5000 : scanIntervalMs / 2,
      backoff: 1.0,
      version: versionToNetSnmp(this.options.version),
    }

    if (options.version === snmp.Version3) {
      const user: any = {
        name: this.options.username,
      }

      if (this.options.auth_key && this.options.priv_key) {
        user.level = snmp.SecurityLevel.authPriv
      } else if (this.options.auth_key && !this.options.priv_key) {
        user.level = snmp.SecurityLevel.authNoPriv
      } else {
        user.level = snmp.SecurityLevel.noAuthNoPriv
      }

      if (this.options.auth_protocol) {
        user.authProtocol = snmp.AuthProtocols[this.options.auth_protocol]
      }
      if (this.options.auth_key) {
        user.authKey = this.options.auth_key
      }

      if (this.options.priv_protocol) {
        user.privProtocol = snmp.PrivProtocols[this.options.priv_protocol]
      }
      if (this.options.priv_key) {
        user.privKey = this.options.priv_key
      }

      this.session = snmp.createV3Session(this.options.host, user, options)
    } else {
      const community = this.options.community ?? "public"
      this.session = snmp.createSession(this.options.host, community, options)
    }

    this.session.on("close", () => {
      if (this.ending) {
        return
      }

      this.log.warning(`Target ${this.options.host} disconnected`)
      this.pause()

      setTimeout(() => {
        this.connect()
      }, 2000)
    })

    this.resume()
  }

  public close() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }

  private getOids(
    oids: string[],
  ): Promise<Array<{ value: unknown; type: any }>> {
    return new Promise((resolve, reject) => {
      this.session.get(oids, (error: Error, results: any[]) => {
        if (error) reject(error)
        else resolve(results)
      })
    })
  }

  private decodeVarbind(
    result: any,
    sensor: SensorConfig,
  ): string | number | bigint | boolean | Error {
    if (!result) return new Error("SNMP sensor returned no varbind")

    if (snmp.isVarbindError(result)) {
      return new Error(snmp.varbindError(result))
    }

    let { value, type } = result as {
      value: string | number | Buffer | bigint
      type: any
    }

    switch (type) {
      case snmp.ObjectType.Counter64:
        value = toBigIntBE(value as Buffer)
        break
      case snmp.ObjectType.OctetString:
        value = value.toString()
        break
    }

    if (Buffer.isBuffer(value)) value = value.toString()

    let finalValue = value as string | number | bigint | boolean
    if (sensor.transform) {
      finalValue = evaluateTransform(
        sensor.transform,
        value as string | number | bigint,
      )
    }

    return finalValue
  }

  private async fetch() {
    if (this.fetching) {
      this.log.warning(
        `Skipping overlapping poll for ${this.options.host}; previous poll is still running`,
      )
      return
    }

    this.fetching = true

    const normalSensors = this.options.sensors
      .map((sensor, index) => ({ sensor, index }))
      .filter(({ sensor }) => (sensor.source ?? "snmp") === "snmp")
    const interfaceSensors = this.options.sensors
      .map((sensor, index) => ({ sensor, index }))
      .filter(({ sensor }) => sensor.source === "interface")
    const juniperSensors = this.options.sensors
      .map((sensor, index) => ({ sensor, index }))
      .filter(({ sensor }) => sensor.source === "juniper_ex_vlan")

    this.log.debug(
      `Fetching ${normalSensors.length} direct sensor(s), ${interfaceSensors.length} live interface sensor(s), and ${juniperSensors.length} Juniper VLAN sensor(s) from ${this.options.host}...`,
    )

    const values: Array<string | number | bigint | boolean | Error> = new Array(
      this.options.sensors.length,
    )

    try {
      if (normalSensors.length) {
        try {
          const oids = normalSensors.map(({ sensor }) => sensor.oid as string)
          const varbinds = await this.getOids(oids)

          for (let position = 0; position < normalSensors.length; position++) {
            const { sensor, index } = normalSensors[position]
            values[index] = this.decodeVarbind(varbinds[position], sensor)
          }
        } catch (error) {
          const failure =
            error instanceof Error ? error : new Error(String(error))
          for (const { index } of normalSensors) values[index] = failure
        }
      }

      let ifNames: SnmpTable | undefined
      if (interfaceSensors.length || juniperSensors.length) {
        try {
          ifNames = await walkTable(this.session, IF_NAME_OID)
        } catch (error) {
          const failure =
            error instanceof Error ? error : new Error(String(error))
          for (const { index } of interfaceSensors) values[index] = failure
          for (const { index } of juniperSensors) values[index] = failure
        }
      }

      if (interfaceSensors.length && ifNames) {
        const requests: Array<{
          sensor: SensorConfig
          index: number
          oid: string
        }> = []

        for (const { sensor, index } of interfaceSensors) {
          const candidates = interfaceCandidates(sensor)
          const resolved = resolveInterfaceIndex(ifNames, candidates)

          if (!resolved) {
            values[index] = new SensorUnavailableError(
              `Interface not currently exposed: ${candidates.join(" or ")}`,
            )
            continue
          }

          requests.push({
            sensor,
            index,
            oid: interfaceOid(
              sensor.attribute as InterfaceAttribute,
              resolved.ifIndex,
            ),
          })
        }

        if (requests.length) {
          try {
            const varbinds = await this.getOids(
              requests.map((request) => request.oid),
            )

            for (let position = 0; position < requests.length; position++) {
              const { sensor, index } = requests[position]
              values[index] = this.decodeVarbind(varbinds[position], sensor)
            }
          } catch (error) {
            const failure =
              error instanceof Error ? error : new Error(String(error))
            for (const { index } of requests) values[index] = failure
          }
        }
      }

      if (juniperSensors.length && ifNames) {
        try {
          const states = await collectJuniperVlanPortStates(
            this.session,
            ifNames,
          )

          for (const { sensor, index } of juniperSensors) {
            const candidates = interfaceCandidates(sensor)
            let state
            let resolvedName = ""

            for (const candidate of candidates) {
              state = states.get(candidate)
              if (state) {
                resolvedName = candidate
                break
              }
            }

            if (!state) {
              values[index] = new SensorUnavailableError(
                `Juniper VLAN data not currently available for interface ${candidates.join(" or ")}`,
              )
              continue
            }

            this.log.debug(
              `Resolved Juniper VLAN sensor ${sensor.name} through ${resolvedName}`,
            )
            values[index] = juniperVlanAttributeValue(
              state,
              sensor.attribute as any,
            )
          }
        } catch (error) {
          const failure =
            error instanceof Error ? error : new Error(String(error))
          for (const { index } of juniperSensors) values[index] = failure
        }
      }

      for (let i = 0; i < values.length; i++) {
        if (values[i] === undefined) {
          values[i] = new Error("Sensor returned no value")
        }
      }

      this.emit("response", values, this.options)
    } finally {
      this.fetching = false
    }
  }
}
