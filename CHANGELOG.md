# Changelog

## 0.9.10

- Add graceful `SIGTERM` handling alongside the existing `SIGINT` shutdown path so standalone/container runtimes close MQTT and SNMP sessions cleanly regardless of the normal termination signal.
- Make shutdown single-flight so duplicate termination/error events cannot run MQTT/SNMP cleanup concurrently.
- Add a direct shutdown-signal regression and run it in pull-request CI before Docker image builds.
- Preserve polling, MQTT reconnect behaviour, transform evaluation, Home Assistant discovery, live IF-MIB resolution, and Juniper EX3300 handling unchanged.

## 0.9.9

- Add generic live IF-MIB interface sensors that resolve configured interface-name candidates to the current ifIndex on every poll.
- Add runtime attributes for operational status, administrative status, negotiated/high speed, 64-bit RX/TX counters, and interface alias.
- Reuse one ifName walk per target poll across live interface sensors and Juniper VLAN sensors.
- Allow Juniper VLAN sensors to specify alternate interface-name candidates so GE/XE mode changes remain live without regenerating configuration.
- Publish unexposed interface sensors as unavailable without warning-level log spam; no ifIndex is guessed for empty cages.
- Add schema, semantic, reindex, GE/XE fallback, and missing-interface regression coverage.

## 0.9.8

- Replace raw `eval(sensor.transform)` with a restricted expression evaluator while preserving documented arithmetic and safe `Math.*` transforms.
- Reject unsupported SNMP versions instead of silently falling back to SNMPv1.
- Add semantic SNMPv3 validation for username/auth/privacy dependencies.
- Reject duplicate explicit Home Assistant `object_id` identities before discovery is published while preserving legacy no-`object_id` configurations.
- Remove stale `user` and `level` SNMPv3 schema fields that are not used by the runtime.
- Update `js-yaml` from 5.2.0 to 5.2.3 with the upstream security fixes.
- Add regression coverage for unsafe transforms, SNMP version handling, semantic configuration validation, and schema cleanup.

## 0.9.7

- Allow `object_id` in validated sensor configuration, matching the existing runtime and Home Assistant discovery types.
- Add a config-schema regression test and run it as part of the Docker build.
- Re-run pull-request CI when new commits are pushed to an existing pull request.

## 0.9.6

- Add numeric-OID Juniper EX VLAN collection for non-ELS EX switches such as the EX3300.
- Correlate IF-MIB interface names, BRIDGE-MIB bridge ports, Q-BRIDGE PVIDs, and JUNIPER-VLAN-MIB port membership.
- Add derived `juniper_ex_vlan` sensors for access/trunk mode, native VLAN, member VLANs, tagged VLANs, untagged VLANs, and a compact summary.
- Prevent overlapping polls while table walks are still running.

## 0.9.3

- Serialize MQTT publishes through one shared queue to prevent socket `drain` listener accumulation during large discovery and startup bursts.
- Preserve publish error propagation while keeping the queue usable after failures.
- Wait for queued publishes before closing the MQTT client.

## 0.9.2

- Replaced private package-registry URLs in `yarn.lock` with the public Yarn registry.
- Added explicit public Yarn and npm registry configuration.
- Retains the immediate startup polling fix from v0.9.1.

## 0.9.1

- Delay initial target polling for two seconds after Home Assistant MQTT discovery is published, preventing non-retained startup values from being missed.
- Poll every target once immediately when it starts or resumes, then continue at its configured scan interval.
- Clear any existing target interval before resuming to prevent duplicate polling timers after MQTT reconnects.

## 0.9.0

- Rename the project to Switch Vision SNMP2MQTT.
- Rename package and repository metadata to `switch-vision-snmp2mqtt`.
- Change startup branding to Switch Vision.
- Move Cisco-specific placeholder helpers under `src/vendors/cisco/`.
- Preserve the upstream SNMP polling and MQTT behaviour.
