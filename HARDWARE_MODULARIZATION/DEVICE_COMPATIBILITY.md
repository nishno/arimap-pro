# Device compatibility

No physical devices were connected or certified in this implementation.

| Device | Pilot | Required validation |
| --- | --- | --- |
| Manual input | Implemented | Field usability, locale decimal entry |
| Keyboard-wedge USB/BT scanner | Text field accepts keyboard input | Model, suffix/Enter, scan burst, repeat debounce, tablet OS |
| Tablet camera | Not connected | Permission, FPS/CPU budget, worker loop, cleanup, repeated-frame suppression |
| NFC | Not connected | OS/browser API or native bridge, badge identity versus receipt identity |
| Scale | Manual entry only | Model/protocol, stable weight, units, tare, disconnect, calibration and adapter |
| Zebra | Not connected | Model, ZPL/support, transport, bridge, spooler acknowledgments and reprints |

No assumptions that browsers can open arbitrary Bluetooth serial devices, raw printer TCP ports or RTSP streams. Test actual equipment before selecting adapters. No automatic drone flight is included.
