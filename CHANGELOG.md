# Changelog

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
