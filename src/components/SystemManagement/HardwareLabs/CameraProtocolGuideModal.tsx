import React, { useState } from 'react';
import { 
    X, Code2, Terminal, Copy, Check, ExternalLink, Radio, ShieldCheck, 
    Video, Server, BookOpen, Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface CameraProtocolGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CameraProtocolGuideModal: React.FC<CameraProtocolGuideModalProps> = ({
    isOpen,
    onClose
}) => {
    const [selectedLanguage, setSelectedLanguage] = useState<'nodejs' | 'python' | 'go' | 'csharp'>('python');
    const [selectedTopic, setSelectedTopic] = useState<'sadp_discovery' | 'onvif_discovery' | 'isapi_auth' | 'rtsp_stream'>('sadp_discovery');
    const [copied, setCopied] = useState<boolean>(false);

    if (!isOpen) return null;

    const copyCode = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Code copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    // Code snippets dictionary
    const CODE_SNIPPETS: Record<string, Record<string, string>> = {
        sadp_discovery: {
            python: `# Hikvision SADP Discovery Protocol in Python (UDP 37020)
# Broadcasts XML Inquiry packet to 239.255.255.250:37020 and parses responses.
import socket
import xml.etree.ElementTree as ET
import uuid

SADP_MULTICAST_GROUP = "239.255.255.250"
SADP_PORT = 37020

def discover_hikvision_devices(timeout=3):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    sock.settimeout(timeout)

    # SADP XML Inquiry Probe
    probe_packet = f"""<?xml version="1.0" encoding="utf-8"?>
<Probe>
    <Uuid>{uuid.uuid4()}</Uuid>
    <Types>inquiry</Types>
</Probe>""".encode("utf-8")

    print(f"[*] Sending SADP broadcast probe to {SADP_MULTICAST_GROUP}:{SADP_PORT}...")
    sock.sendto(probe_packet, (SADP_MULTICAST_GROUP, SADP_PORT))

    devices = []
    try:
        while True:
            data, addr = sock.recvfrom(4096)
            try:
                root = ET.fromstring(data.decode("utf-8", errors="ignore"))
                dev = {
                    "ip": root.findtext("IPv4Address"),
                    "http_port": int(root.findtext("HttpPort", "80")),
                    "command_port": int(root.findtext("CommandPort", "8000")),
                    "mac": root.findtext("MAC"),
                    "model": root.findtext("DeviceDescription"),
                    "software_version": root.findtext("SoftwareVersion"),
                    "activated": root.findtext("Activated") == "true"
                }
                devices.append(dev)
                print(f"[+] Found Device: {dev['model']} at {dev['ip']} (MAC: {dev['mac']})")
            except Exception as e:
                pass
    except socket.timeout:
        print(f"[*] Scan finished. Found {len(devices)} Hikvision device(s).")
    finally:
        sock.close()
    return devices

if __name__ == "__main__":
    discover_hikvision_devices()`,
            nodejs: `// Hikvision SADP Discovery in Node.js (UDP 37020)
const dgram = require('dgram');
const { randomUUID } = require('crypto');

const SADP_MULTICAST = '239.255.255.250';
const SADP_PORT = 37020;

function discoverHikvisionDevices(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discovered = [];

    const probeXml = \`<?xml version="1.0" encoding="utf-8"?>
<Probe>
  <Uuid>\${randomUUID()}</Uuid>
  <Types>inquiry</Types>
</Probe>\`;

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(2);
      socket.send(Buffer.from(probeXml), SADP_PORT, SADP_MULTICAST, (err) => {
        if (err) console.error('Failed to send SADP probe:', err);
        else console.log('[*] SADP Probe broadcasted on port 37020');
      });
    });

    socket.on('message', (msg, rinfo) => {
      const xmlStr = msg.toString('utf8');
      const ip = (xmlStr.match(/<IPv4Address>([^<]+)<\\/IPv4Address>/) || [])[1];
      const model = (xmlStr.match(/<DeviceDescription>([^<]+)<\\/DeviceDescription>/) || [])[1];
      const mac = (xmlStr.match(/<MAC>([^<]+)<\\/MAC>/) || [])[1];
      const port = (xmlStr.match(/<HttpPort>([^<]+)<\\/HttpPort>/) || [])[1];

      if (ip && !discovered.some(d => d.ip === ip)) {
        const dev = { ip, model, mac, port: Number(port || 80), remoteHost: rinfo.address };
        discovered.push(dev);
        console.log(\`[+] Discovered: \${model} @ \${ip}:\${port}\`);
      }
    });

    setTimeout(() => {
      socket.close();
      resolve(discovered);
    }, timeoutMs);
  });
}

discoverHikvisionDevices().then(devices => console.log('All Devices:', devices));`,
            go: `// Hikvision SADP Discovery in Go (UDP 37020)
package main

import (
	"fmt"
	"net"
	"regexp"
	"time"
)

const (
	SADPGroup = "239.255.255.250:37020"
)

func main() {
	addr, err := net.ResolveUDPAddr("udp4", SADPGroup)
	if err != nil {
		panic(err)
	}

	conn, err := net.ListenUDP("udp4", nil)
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	probe := []byte(\`<?xml version="1.0" encoding="utf-8"?><Probe><Uuid>a78912-go-sadp</Uuid><Types>inquiry</Types></Probe>\`)
	_, err = conn.WriteTo(probe, addr)
	if err != nil {
		fmt.Printf("Error sending SADP: %v\\n", err)
		return
	}

	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	buf := make([]byte, 4096)
	ipRegex := regexp.MustCompile(\`<IPv4Address>([^<]+)</IPv4Address>\`)
	modelRegex := regexp.MustCompile(\`<DeviceDescription>([^<]+)</DeviceDescription>\`)

	for {
		n, src, err := conn.ReadFrom(buf)
		if err != nil {
			break // Timeout reached
		}
		data := string(buf[:n])
		ipMatch := ipRegex.FindStringSubmatch(data)
		modelMatch := modelRegex.FindStringSubmatch(data)
		if len(ipMatch) > 1 && len(modelMatch) > 1 {
			fmt.Printf("[+] Found Hikvision NVR: %s at %s (Source: %s)\\n", modelMatch[1], ipMatch[1], src.String())
		}
	}
}`,
            csharp: `// Hikvision SADP Discovery in C# (.NET 8 / Core)
using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

class HikvisionSadpDiscovery
{
    private const string MulticastGroup = "239.255.255.250";
    private const int SadpPort = 37020;

    public static async Task Main()
    {
        using var client = new UdpClient();
        client.EnableBroadcast = true;
        var endPoint = new IPEndPoint(IPAddress.Parse(MulticastGroup), SadpPort);

        string xmlProbe = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<Probe>
    <Uuid>{Guid.NewGuid()}</Uuid>
    <Types>inquiry</Types>
</Probe>";

        byte[] requestBytes = Encoding.UTF8.GetBytes(xmlProbe);
        await client.SendAsync(requestBytes, requestBytes.Length, endPoint);
        Console.WriteLine("[*] SADP Probe sent on 239.255.255.250:37020...");

        client.Client.ReceiveTimeout = 3500;
        var startTime = DateTime.UtcNow;

        while ((DateTime.UtcNow - startTime).TotalSeconds < 3.5)
        {
            try
            {
                var result = await client.ReceiveAsync();
                string xml = Encoding.UTF8.GetString(result.Buffer);
                var ip = Regex.Match(xml, @"<IPv4Address>([^<]+)</IPv4Address>").Groups[1].Value;
                var model = Regex.Match(xml, @"<DeviceDescription>([^<]+)</DeviceDescription>").Groups[1].Value;
                if (!string.IsNullOrEmpty(ip))
                {
                    Console.WriteLine($"[+] Hikvision Found: {model} at {ip}");
                }
            }
            catch (SocketException) { break; }
        }
    }
}`
        },
        onvif_discovery: {
            python: `# ONVIF WS-Discovery in Python (UDP 3702 multicast)
import socket
import uuid

WS_MULTICAST_GROUP = "239.255.255.250"
WS_PORT = 3702

def discover_onvif(timeout=3):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    sock.settimeout(timeout)

    message_id = f"urn:uuid:{uuid.uuid4()}"
    soap_probe = f"""<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl"
          xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">{message_id}</wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types>dn:NetworkVideoTransmitter</Types>
    </Probe>
  </Body>
</Envelope>""".encode("utf-8")

    sock.sendto(soap_probe, (WS_MULTICAST_GROUP, WS_PORT))
    print(f"[*] Sent ONVIF Probe to {WS_MULTICAST_GROUP}:{WS_PORT}")

    try:
        while True:
            data, addr = sock.recvfrom(8192)
            print(f"[+] Received ONVIF ProbeMatch from {addr[0]}:\\n{data.decode()[:200]}...")
    except socket.timeout:
        print("[*] ONVIF probe complete.")
    finally:
        sock.close()

if __name__ == "__main__":
    discover_onvif()`,
            nodejs: `// ONVIF WS-Discovery in Node.js
const dgram = require('dgram');
const crypto = require('crypto');

const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const msgId = \`urn:uuid:\${crypto.randomUUID()}\`;

const probeXml = \`<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl"
          xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">\${msgId}</wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types>dn:NetworkVideoTransmitter</Types>
    </Probe>
  </Body>
</Envelope>\`;

client.bind(() => {
  client.setBroadcast(true);
  client.setMulticastTTL(2);
  client.send(Buffer.from(probeXml), 3702, '239.255.255.250');
});

client.on('message', (msg, rinfo) => {
  console.log(\`[+] ONVIF Device Response from \${rinfo.address}:\${rinfo.port}\`);
});`,
            go: `// Go ONVIF Probe example
package main
import (
    "fmt"
    "net"
    "time"
)
func main() {
    conn, _ := net.ListenUDP("udp4", nil)
    defer conn.Close()
    target, _ := net.ResolveUDPAddr("udp4", "239.255.255.250:3702")
    probe := []byte(\`<?xml version="1.0"?><Envelope xmlns="http://www.w3.org/2003/05/soap-envelope"><Body><Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery"><Types>dn:NetworkVideoTransmitter</Types></Probe></Body></Envelope>\`)
    conn.WriteTo(probe, target)
    conn.SetReadDeadline(time.Now().Add(3 * time.Second))
    buf := make([]byte, 4096)
    for {
        n, addr, err := conn.ReadFrom(buf)
        if err != nil { break }
        fmt.Printf("[+] ONVIF reply from: %s (%d bytes)\\n", addr, n)
    }
}`,
            csharp: `// C# ONVIF WS-Discovery
using System;
using System.Net;
using System.Net.Sockets;
using System.Text;

class OnvifDiscovery {
    static async System.Threading.Tasks.Task Main() {
        var client = new UdpClient();
        var target = new IPEndPoint(IPAddress.Parse("239.255.255.250"), 3702);
        string soap = "<?xml version=\\"1.0\\"?><Envelope xmlns=\\"http://www.w3.org/2003/05/soap-envelope\\"><Body><Probe xmlns=\\"http://schemas.xmlsoap.org/ws/2005/04/discovery\\"><Types>dn:NetworkVideoTransmitter</Types></Probe></Body></Envelope>";
        var bytes = Encoding.UTF8.GetBytes(soap);
        await client.SendAsync(bytes, bytes.Length, target);
        Console.WriteLine("[*] ONVIF probe broadcasted...");
    }
}`
        },
        isapi_auth: {
            python: `# Hikvision ISAPI HTTP Digest Authentication in Python
# Interacts with /ISAPI/System/deviceInfo and /ISAPI/ContentMgmt/InputProxy/channels
import requests
from requests.auth import HTTPDigestAuth
import xml.etree.ElementTree as ET

NVR_HOST = "192.168.1.120" # or WAN Global IP
NVR_PORT = 80              # or HTTP port
USERNAME = "admin"
PASSWORD = "YOUR_CAMERA_PASSWORD"

session = requests.Session()
session.auth = HTTPDigestAuth(USERNAME, PASSWORD)

def get_device_info():
    url = f"http://{NVR_HOST}:{NVR_PORT}/ISAPI/System/deviceInfo"
    response = session.get(url, timeout=5)
    
    if response.status_code == 200:
        root = ET.fromstring(response.text)
        print("=== Hikvision Device Info ===")
        print(f"Device Name: {root.findtext('{http://www.hikvision.com/ver20/XMLSchema}deviceName')}")
        print(f"Model: {root.findtext('{http://www.hikvision.com/ver20/XMLSchema}model')}")
        print(f"Serial: {root.findtext('{http://www.hikvision.com/ver20/XMLSchema}serialNumber')}")
        print(f"Firmware: {root.findtext('{http://www.hikvision.com/ver20/XMLSchema}firmwareVersion')}")
        return True
    else:
        print(f"[!] Authentication Failed. Status: {response.status_code}")
        return False

def get_nvr_channels():
    # Retrieve all IP channels connected to the DS-7716NI NVR
    url = f"http://{NVR_HOST}:{NVR_PORT}/ISAPI/ContentMgmt/InputProxy/channels"
    response = session.get(url, timeout=5)
    if response.status_code == 200:
        print("=== Active NVR Channels ===")
        print(response.text)

if __name__ == "__main__":
    if get_device_info():
        get_nvr_channels()`,
            nodejs: `// Hikvision ISAPI Digest Authentication in Node.js
// Uses axios with digest-fetch or urilib
const DigestFetch = require('digest-fetch');

const client = new DigestFetch('admin', 'PlantationAdmin2026!');
const NVR_BASE = 'http://192.168.1.120:80';

async function fetchDeviceInfo() {
  try {
    const res = await client.fetch(\`\${NVR_BASE}/ISAPI/System/deviceInfo\`, {
      method: 'GET',
      headers: { 'Accept': 'application/xml' }
    });
    
    if (res.status === 200) {
      const xml = await res.text();
      console.log('[+] Authenticated to Hikvision ISAPI:');
      console.log(xml);
    } else {
      console.error(\`[-] Failed: HTTP \${res.status} Unauthorized\`);
    }
  } catch (err) {
    console.error('Connection error:', err);
  }
}

fetchDeviceInfo();`,
            go: `// Go HTTP Digest Auth for Hikvision ISAPI
package main
import (
    "fmt"
    "net/http"
)
func main() {
    // Note: Use standard github.com/icholy/digest library for RFC 2617 Digest Auth
    fmt.Println("Connect to Hikvision ISAPI: http://192.168.1.120/ISAPI/System/deviceInfo")
}`,
            csharp: `// C# HttpClient with CredentialCache for Hikvision Digest Auth
using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

class HikvisionIsapi {
    static async Task Main() {
        var handler = new HttpClientHandler();
        var uri = new Uri("http://192.168.1.120:80/ISAPI/System/deviceInfo");
        
        var credentials = new CredentialCache();
        credentials.Add(uri, "Digest", new NetworkCredential("admin", "PlantationAdmin2026!"));
        handler.Credentials = credentials;

        using var client = new HttpClient(handler);
        var response = await client.GetAsync(uri);
        Console.WriteLine($"Status: {response.StatusCode}");
        string content = await response.Content.ReadAsStringAsync();
        Console.WriteLine(content);
    }
}`
        },
        rtsp_stream: {
            python: `# Standard Hikvision RTSP Stream URL formats for OpenCV / WebRTC / FFmpeg
# Hikvision Channel URL Syntax:
# Main Stream (High Res): rtsp://<user>:<password>@<ip>:554/Streaming/Channels/<channel>01
# Sub Stream (Preview):   rtsp://<user>:<password>@<ip>:554/Streaming/Channels/<channel>02
# Zero Channel (Multi):   rtsp://<user>:<password>@<ip>:554/Streaming/Channels/001

import cv2

RTSP_URL = "rtsp://CAMERA_HOST/192.168.1.120:554/Streaming/Channels/102"

def play_stream():
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        print("[!] Could not open RTSP stream. Check credentials and port 554.")
        return

    print("[+] RTSP Stream connected successfully. Displaying frames...")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        cv2.imshow("Hikvision NVR Live Feed", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    play_stream()`,
            nodejs: `// Stream Hikvision RTSP via FFmpeg / WebSocket to HTML5 Canvas
// Command to transcode RTSP into HLS / WebRTC in Node:
const { spawn } = require('child_process');

const rtspUrl = 'rtsp://CAMERA_HOST/192.168.1.120:554/Streaming/Channels/102';

// Example: Transcode to ultra-low-latency HLS or WebRTC
const ffmpeg = spawn('ffmpeg', [
  '-rtsp_transport', 'tcp',
  '-i', rtspUrl,
  '-c:v', 'copy',
  '-f', 'flv',
  'rtmp://localhost/live/ch1'
]);

ffmpeg.stderr.on('data', (data) => {
  // console.log(\`FFmpeg: \${data}\`);
});`,
            go: `// Go RTSP Player via gortsplib
package main
import "fmt"
func main() {
    url := "rtsp://CAMERA_HOST/192.168.1.120:554/Streaming/Channels/101"
    fmt.Printf("RTSP Connection Target: %s\\n", url)
}`,
            csharp: `// C# FFmpeg.AutoGen / LibVLCSharp RTSP Viewer
string rtspUrl = "rtsp://CAMERA_HOST/192.168.1.120:554/Streaming/Channels/102";
System.Console.WriteLine($"Connect with LibVLCSharp: {rtspUrl}");`
        }
    };

    const currentCode = CODE_SNIPPETS[selectedTopic]?.[selectedLanguage] || '// No code example available';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in select-none">
            <div className="bg-slate-900 border border-slate-700/80 rounded-[2.5rem] w-full max-w-4xl shadow-2xl text-white flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                            <BookOpen size={22} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">
                                Developer & System Admin Reference Guide
                            </span>
                            <h3 className="text-lg font-black uppercase text-white tracking-tight">
                                Hikvision DS-7716NI NVR: Local Subnet Discovery & ISAPI Control
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Production-grade SADP (UDP 37020), ONVIF WS-Discovery (UDP 3702), HTTP Digest Authentication, and RTSP Stream Syntax
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-Header Topic Selector */}
                <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        <button
                            onClick={() => setSelectedTopic('sadp_discovery')}
                            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[11px] transition-all flex items-center gap-1.5 ${
                                selectedTopic === 'sadp_discovery' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Radio size={13} /> 1. SADP UDP 37020
                        </button>
                        <button
                            onClick={() => setSelectedTopic('onvif_discovery')}
                            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[11px] transition-all flex items-center gap-1.5 ${
                                selectedTopic === 'onvif_discovery' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Layers size={13} /> 2. ONVIF WS-Discovery
                        </button>
                        <button
                            onClick={() => setSelectedTopic('isapi_auth')}
                            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[11px] transition-all flex items-center gap-1.5 ${
                                selectedTopic === 'isapi_auth' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ShieldCheck size={13} /> 3. ISAPI Digest Auth
                        </button>
                        <button
                            onClick={() => setSelectedTopic('rtsp_stream')}
                            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[11px] transition-all flex items-center gap-1.5 ${
                                selectedTopic === 'rtsp_stream' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Video size={13} /> 4. RTSP Video Streams
                        </button>
                    </div>

                    {/* Language Switcher */}
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-black uppercase font-mono">
                        {(['python', 'nodejs', 'go', 'csharp'] as const).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setSelectedLanguage(lang)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    selectedLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {lang === 'csharp' ? 'C#' : lang === 'nodejs' ? 'Node.js' : lang}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Topic Breakdown & Documentation */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                    {/* Topic Explanatory Box */}
                    {selectedTopic === 'sadp_discovery' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2">
                            <h4 className="font-black uppercase text-blue-400 tracking-wider">
                                📡 How Hikvision SADP Protocol Works (Port 37020 UDP)
                            </h4>
                            <p className="text-slate-300 leading-relaxed">
                                SADP (Search Active Devices Protocol) is Hikvision's proprietary L2/L3 UDP broadcast protocol.
                                Your client sends a UDP packet containing XML <code className="text-amber-400">&lt;Probe&gt;</code> to multicast IP <code className="text-emerald-400">239.255.255.250:37020</code> or broadcast <code className="text-emerald-400">255.255.255.255:37020</code>.
                                All active Hikvision NVRs (including DS-7716NI, DS-7616NI) and IP cameras immediately respond with their IP, Subnet Mask, Gateway, MAC Address, HTTP Port, SDK Port (8000), Software Version, and Activation Status—even if on a different subnet before initial configuration.
                            </p>
                        </div>
                    )}

                    {selectedTopic === 'onvif_discovery' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2">
                            <h4 className="font-black uppercase text-blue-400 tracking-wider">
                                🌐 How ONVIF WS-Discovery Works (Port 3702 UDP)
                            </h4>
                            <p className="text-slate-300 leading-relaxed">
                                ONVIF uses the OASIS WS-Discovery specification over UDP multicast at <code className="text-emerald-400">239.255.255.250:3702</code>.
                                It queries <code className="text-amber-400">dn:NetworkVideoTransmitter</code>. Any ONVIF Profile S/T/G compliant NVR or IP camera returns its device service endpoint URL (e.g., <code className="text-slate-200">http://192.168.1.120:80/onvif/device_service</code>).
                            </p>
                        </div>
                    )}

                    {selectedTopic === 'isapi_auth' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2">
                            <h4 className="font-black uppercase text-blue-400 tracking-wider">
                                🔐 HTTP Digest Authentication & ISAPI Endpoints
                            </h4>
                            <p className="text-slate-300 leading-relaxed">
                                Hikvision cameras and NVRs strictly enforce <strong>HTTP Digest Authentication (RFC 2617 / RFC 7616)</strong> for ISAPI.
                                Key production endpoints:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                <li><code className="text-emerald-400">GET /ISAPI/System/deviceInfo</code>: Model number, serial, firmware version, and MAC address.</li>
                                <li><code className="text-emerald-400">GET /ISAPI/ContentMgmt/InputProxy/channels</code>: Returns all physical & IP cameras mapped to the 16 channels of the DS-7716NI NVR.</li>
                                <li><code className="text-emerald-400">GET /ISAPI/System/status</code>: Real-time CPU, RAM, and storage health.</li>
                                <li><code className="text-emerald-400">PUT /ISAPI/PTZCtrl/channels/1/continuous</code>: Pan/Tilt/Zoom motor movement commands.</li>
                            </ul>
                        </div>
                    )}

                    {selectedTopic === 'rtsp_stream' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2">
                            <h4 className="font-black uppercase text-blue-400 tracking-wider">
                                🎥 Standard Hikvision RTSP URL Syntax
                            </h4>
                            <p className="text-slate-300 leading-relaxed">
                                The RTSP URL specifies the channel number and the stream quality track:
                            </p>
                            <div className="p-3 bg-slate-900 rounded-xl font-mono text-[11px] space-y-1.5 text-slate-200">
                                <div>
                                    <span className="text-slate-500">Main Stream (4K / 1080p High Quality):</span><br />
                                    <code className="text-emerald-400">rtsp://user:pass@host:554/Streaming/Channels/&lt;Channel&gt;01</code> (e.g. 101 for CH1, 1601 for CH16)
                                </div>
                                <div>
                                    <span className="text-slate-500">Sub Stream (Low Latency / WebRTC / Mobile):</span><br />
                                    <code className="text-blue-400">rtsp://user:pass@host:554/Streaming/Channels/&lt;Channel&gt;02</code> (e.g. 102 for CH1, 1602 for CH16)
                                </div>
                                <div>
                                    <span className="text-slate-500">Zero Channel (Multi-screen Matrix):</span><br />
                                    <code className="text-purple-400">rtsp://user:pass@host:554/Streaming/Channels/001</code>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Code Display Area */}
                    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
                        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                                <Code2 size={14} className="text-indigo-400" />
                                <span className="text-slate-400 uppercase">
                                    {selectedLanguage.toUpperCase()} IMPLEMENTATION
                                </span>
                            </div>

                            <button
                                onClick={() => copyCode(currentCode)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all"
                            >
                                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copied ? 'Copied!' : 'Copy Code'}
                            </button>
                        </div>

                        <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto leading-relaxed custom-scrollbar max-h-96">
                            <code>{currentCode}</code>
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <span className="text-[10px] text-slate-500 font-mono">
                        RFC 2617 Digest Auth • OASIS WS-Discovery • Hikvision ISAPI v2.0
                    </span>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
