# Guria pilot and worldwide rollout

The first site is the owner's approximately 15-hectare plantation in Guria, Georgia. Wi-Fi does not cover the whole property. Exact coordinates, elevation, boundary shape, terrain, crop varieties, mains power and operator signal strength have not been supplied. Do not reuse the app's old hard-coded 48.2-hectare boundary or coordinates as the actual site. Those legacy coordinates are not a verified Guria location.

## Recommended connection

**LoRaWAN sensor nodes → outdoor LoRaWAN gateway → LTE/4G backhaul → network server → authenticated AgriMap ingest.**

LoRa and LTE have different jobs. Dragino D20S-LB-type nodes use the low-power LoRa radio to send small measurements to a gateway; they are not ordinary Wi-Fi or LTE devices. The gateway can use Ethernet, available Wi-Fi or a SIM/4G connection to reach the internet. One LTE gateway generally avoids separate mobile subscriptions and SIM provisioning for every sensor. A standalone cellular sensor is an alternative if LoRaWAN coverage proves impractical, but requires suitable local LTE-M/NB-IoT coverage (which must not be assumed from ordinary phone LTE coverage) or a supported cellular modem and recurring subscriptions.

LoRa's chirp-spread-spectrum modulation supports long links at low data rates and low node power. The quoted range is conditional. Higher spreading factors increase link robustness and airtime, reducing capacity and potentially affecting duty-cycle limits and battery life. Mountains, trees, wet canopy, poor antenna placement and interference still matter. LoRaWAN is not a mesh: add another gateway for coverage rather than assuming battery sensor nodes relay each other's messages.

If 15 hectares were a compact square, it would be about 387 metres on each side and about 548 metres across the diagonal. Actual vineyard/orchard geometry may be much longer. One high, well-placed gateway is a reasonable pilot, not a coverage guarantee. Test the farthest point, a low hollow and an obstructed point with wet foliage; record packet-delivery rates and RSSI/SNR over several days. Test local mobile operators at the gateway position before committing to an LTE router or provider.

## First purchase list

| Item | Pilot quantity | Buying criteria |
| --- | --- | --- |
| Industrial outdoor LoRaWAN gateway with LTE option | 1 | Eight-channel concentrator or better; supported Georgian radio plan; weather rating; external antenna; reliable LTE module/operator; secure remote updates. Consider industrial Milesight, RAK or Dragino gateway families and verify the exact LTE variant. |
| Combined temperature/relative-humidity sensor | 3 | Outdoor probe, calibration information, long-term RH accuracy, replaceable battery and a ventilated radiation shield. Do not substitute D20S-LB alone for a humidity sensor. |
| Additional D20S-LB-class temperature probe | 1–2 optional | Canopy/blossom-level frost monitoring. Verify exact probe options and waterproofing. Place reference air measurements separately. |
| Tipping-bucket rain gauge + compatible LoRaWAN pulse node | 1 | Calibrated millimetres per pulse; debounce; counter reset handling; accessible level mount away from canopy/obstructions. |
| Soil-moisture/temperature probe | 1–2 | Root-zone installation and calibration for the actual soil; optional EC. Soil moisture percentages from different probes require calibration before comparison. |
| Power/installation kit | 1 site kit | Proper antenna/feedline, grounding, lightning/surge protection, outdoor enclosure and glands, UPS; solar sizing only after measuring router/gateway consumption and worst-season solar availability. |
| Reference thermometer/RH meter | 1 | Used to compare stations and detect installation bias before trusting alerts. |

Useful optional additions: a leaf-wetness sensor for disease-risk windows, wind speed/direction for spraying, and solar radiation for evapotranspiration. A rain switch is not a calibrated rain gauge. Air humidity is not soil moisture or leaf wetness.

Measure a reference station in a shielded, representative position. Put a second node in the frost-prone low area and a third in the more exposed/high area. Avoid unshielded enclosures in direct sun. Soil probes belong at the crops' actual root-zone depths. Maintain rain gauges and calibrate probes regularly.

EU868-compatible equipment is a common candidate for this region, but confirm the permitted frequencies, channel plan, power and duty-cycle rules with the Georgian Communications Commission or a competent local supplier before ordering. Never purchase US915 equipment based only on a lower price. All nodes and the gateway must use compatible regional settings.

## Separation from camera networking

LoRaWAN carries sensor messages, not RTSP video. Keep cameras on wired PoE or adequate Wi-Fi links to a local video gateway. LTE video may be expensive: a continuous 1-Mbit/s stream is about 10.8 GB/day before overhead; four such streams are about 43 GB/day. Use local recording, lower-bitrate substreams, on-demand remote viewing and realistic LTE bandwidth/data limits. Sensor backhaul is much smaller, but gateway overhead and management still consume data.

## Application milestones

1. Register the actual farm boundary, coordinates, timezone (`Asia/Tbilisi` for this pilot), field IDs, crop varieties and growth stages. Do not overwrite real records with built-in example geometry.
2. Install one gateway and one node. Register OTAA devices in The Things Stack or ChirpStack and verify delivery before buying all devices.
3. Implement an authenticated webhook, manufacturer payload decoder and server-owned device-to-organization mapping. Store original payloads and receive/measurement times. Deduplicate uplinks.
4. Connect three microclimate nodes, rain and soil measurements. Display freshness, battery/link quality and calibration information. Use an offline alert if data stops arriving.
5. Fetch forecasts for the actual coordinates from a licensed provider; keep modeled and observed readings clearly separate. Validate the forecast provider's commercial terms.
6. Pilot frost/rain/humidity alerts with crop-stage thresholds, hysteresis, cooldown, acknowledgement and a tested notification channel. Use measurements and deterministic rules first; AI explains results with their source and uncertainty.
7. Build weekly/monthly/annual summaries only as data accumulates. Historical provider data can supply modeled context, but must not masquerade as past plantation sensor data. Include completeness and calibration gaps.

## Worldwide design

Keep organizationId, siteId, fieldId, stationId and device identity distinct. Configure an IANA timezone, regional radio plan, local units, provider and crop calendars per site. Store raw timestamps in UTC and normalized metric units; convert for display. Support multiple gateways/providers through adapters rather than hard-coded vendor names or one global connection.

Server authorization must derive the tenant from the device registry, not from a browser or webhook-supplied organization name. Separate production observations from demo records. Never share join keys, camera passwords or provider API keys across tenants or store them in browser localStorage. Each site needs its own coverage/power design and local regulatory checks.

Information still needed before a final hardware order: plantation boundary or longest distances, elevations/obstructions, a location with mains power, signal tests for available mobile operators, crop varieties, existing camera/NVR model and codecs, desired alert channels, and budget. These details do not block the software demo.
