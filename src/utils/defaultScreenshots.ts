// Default high-fidelity simulated screenshots for the Agrimesh Agricultural Management Platform
// Saved as premium SVG Data-URIs. High-resolution, crisp line art, and dashboard layouts.

const buildSvgDataUri = (svgContent: string): string => {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent.trim());
};

export const getDefaultScreenshotForStep = (stepId: string): string => {
    switch (stepId) {
        case 'profile-verification':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#10b981" stroke-width="2"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#glow)"/>
  
  <!-- Header -->
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">SECURE AGRIMESH WALLET</text>
  <rect x="290" y="18" width="88" height="18" rx="9" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1"/>
  <circle cx="298" cy="27" r="3" fill="#10b981"/>
  <text x="306" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#10b981">VERIFIED ID</text>

  <!-- Profile Card -->
  <rect x="20" y="55" width="360" height="110" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <circle cx="65" cy="110" r="28" fill="#312e81" stroke="#4f46e5" stroke-width="2"/>
  <text x="65" y="115" font-family="'Inter', sans-serif" font-size="16" font-weight="900" fill="#e0e7ff" text-anchor="middle">GN</text>
  
  <text x="110" y="95" font-family="'Inter', sans-serif" font-size="13" font-weight="900" fill="#ffffff">Giorgi Nishnianidze</text>
  <text x="110" y="112" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#9ca3af">giorgi.nishno@gmail.com</text>
  <text x="110" y="128" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#10b981">Owner • Kakheti Operations</text>
  
  <!-- Trust Index Rating -->
  <text x="20" y="195" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#9ca3af">BIOMETRIC IDENTITY MATCH</text>
  <text x="360" y="195" font-family="'Inter', sans-serif" font-size="10" font-weight="900" fill="#10b981" text-anchor="end">100% SECURE</text>
  <rect x="20" y="205" width="360" height="6" rx="3" fill="#1f2937"/>
  <rect x="20" y="205" width="360" height="6" rx="3" fill="#10b981"/>

  <!-- Footer Info -->
  <circle cx="28" cy="245" r="4" fill="#10b981"/>
  <text x="40" y="248" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#d1d5db">Legal Entity Status: Synced & Verified</text>
  <circle cx="28" cy="265" r="4" fill="#10b981"/>
  <text x="40" y="268" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#d1d5db">Secure Key Pair Generated inside Device</text>
</svg>
            `);

        case 'register-company':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#8b5cf6" stroke-width="2"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#glow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">AGRICULTURAL PRODUCT REGISTRY</text>
  <rect x="285" y="18" width="95" height="18" rx="9" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.3)" stroke-width="1"/>
  <text x="332" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#c084fc" text-anchor="middle">ACTIVE REGISTRY</text>

  <!-- Items -->
  <rect x="20" y="55" width="360" height="65" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="80" font-family="'Inter', sans-serif" font-size="20">🍇</text>
  <text x="70" y="75" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#f3e8ff">Grape (ყურძენი)</text>
  <text x="70" y="92" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#9ca3af">Saperavi, Rkatsiteli • Primary Land Base</text>
  <rect x="300" y="75" width="65" height="20" rx="6" fill="#1e1b4b"/>
  <text x="332" y="88" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#818cf8" text-anchor="middle">2 Varieties</text>

  <rect x="20" y="130" width="360" height="65" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="155" font-family="'Inter', sans-serif" font-size="20">🌱</text>
  <text x="70" y="150" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#fef3c7">Hazelnut (თხილი)</text>
  <text x="70" y="167" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#9ca3af">Anakliuri variety • Lowland Sandy Loam</text>
  <rect x="300" y="150" width="65" height="20" rx="6" fill="#451a03"/>
  <text x="332" y="163" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fbbf24" text-anchor="middle">1 Variety</text>

  <rect x="20" y="210" width="175" height="70" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="232" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800" fill="#6b7280">PRIMARY LOCATION</text>
  <text x="32" y="252" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#ffffff">Kakheti Region</text>
  <text x="32" y="265" font-family="'Inter', sans-serif" font-size="8" fill="#10b981">Georgia Republic</text>

  <rect x="205" y="210" width="175" height="70" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="217" y="232" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800" fill="#6b7280">TOTAL LAND MASS</text>
  <text x="217" y="252" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#ffffff">84.5 Hectares</text>
  <text x="217" y="265" font-family="'Inter', sans-serif" font-size="8" fill="#a7f3d0">3 Land Sectors Plotted</text>
</svg>
            `);

        case 'draw-boundaries':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#10b981" stroke-width="2"/>
  <defs>
    <pattern id="grid-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#161e2e" stroke-width="0.75"/>
    </pattern>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#grid-pattern)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">GIS MAP BOUNDARY NAVIGATOR</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#10b981" text-anchor="middle">CLOSED HOOP</text>

  <!-- Drawing Visual representation -->
  <polygon points="100,60 300,50 260,160 80,190" fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" stroke-width="2"/>
  
  <circle cx="100" cy="60" r="4" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
  <circle cx="300" cy="50" r="4" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
  <circle cx="260" cy="160" r="4" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
  <circle cx="80" cy="190" r="4" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
  
  <rect x="135" y="100" width="110" height="20" rx="10" fill="rgba(15, 23, 42, 0.82)" stroke="#1e293b" stroke-width="1"/>
  <text x="190" y="113" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#a7f3d0" text-anchor="middle">Saperavi Sector A</text>

  <!-- Left Float Menu -->
  <rect x="20" y="60" width="28" height="84" rx="6" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="34" y="80" font-family="'Inter', sans-serif" font-weight="900" font-size="11" fill="#10b981" text-anchor="middle">⮹</text>
  <text x="34" y="105" font-family="'Inter', sans-serif" font-weight="900" font-size="11" fill="#9ca3af" text-anchor="middle">☍</text>
  <text x="34" y="130" font-family="'Inter', sans-serif" font-weight="900" font-size="11" fill="#9ca3af" text-anchor="middle">📍</text>

  <!-- Bottom Panel Info -->
  <rect x="20" y="222" width="360" height="58" rx="10" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="243" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800" fill="#4b5563">BOUNDARIES CALCULATED</text>
  <text x="35" y="263" font-family="'Inter', sans-serif" font-size="13" font-weight="950" fill="#ffffff">54.2 Hectares <tspan font-size="9" font-weight="700" fill="#9ca3af">plotted perimeter</tspan></text>
  <text x="365" y="254" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#10b981" text-anchor="end">READY TO RECONCILE</text>
</svg>
            `);

        case 'register-workers':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#3b82f6" stroke-width="2"/>
  <defs>
    <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#blueGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">EMPLOYEE & CODES REGISTRIES</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#60a5fa" text-anchor="middle">QR IDS SYSTEM</text>

  <!-- Employee Row 1 -->
  <rect x="20" y="55" width="360" height="48" rx="10" fill="#111827" stroke="#1f2937"/>
  <circle cx="44" cy="79" r="14" fill="#2563eb"/>
  <text x="44" y="83" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#eff6ff" text-anchor="middle">LB</text>
  <text x="70" y="74" font-family="'Inter', sans-serif" font-size="10" font-weight="900" fill="#ffffff">Lado Beridze</text>
  <text x="70" y="88" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#9ca3af">Primary Picker • Team Kakheti</text>
  <rect x="300" y="68" width="65" height="20" rx="6" fill="#064e3b"/>
  <text x="332" y="81" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#34d399" text-anchor="middle">Active Code</text>

  <!-- Employee Row 2 -->
  <rect x="20" y="112" width="360" height="48" rx="10" fill="#111827" stroke="#1f2937"/>
  <circle cx="44" cy="136" r="14" fill="#4f46e5"/>
  <text x="44" y="140" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#eff6ff" text-anchor="middle">EK</text>
  <text x="70" y="131" font-family="'Inter', sans-serif" font-size="10" font-weight="900" fill="#ffffff">Eter Kobakhidze</text>
  <text x="70" y="145" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#9ca3af">Supervisor • Team Kakheti</text>
  <rect x="300" y="125" width="65" height="20" rx="6" fill="#064e3b"/>
  <text x="332" y="138" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#34d399" text-anchor="middle">Active Code</text>

  <!-- QR ID Card Card Preview -->
  <rect x="20" y="172" width="360" height="108" rx="12" fill="#0a0d14" stroke="#10b981" stroke-dasharray="3,3" stroke-width="1"/>
  <!-- Simulated QR Code -->
  <rect x="35" y="186" width="80" height="80" rx="6" fill="#ffffff" stroke="#1f2937" stroke-width="1"/>
  <rect x="42" y="193" width="22" height="22" fill="#000000"/>
  <rect x="86" y="193" width="22" height="22" fill="#000000"/>
  <rect x="42" y="237" width="22" height="22" fill="#000000"/>
  <rect x="70" y="215" width="10" height="10" fill="#000000"/>
  <rect x="92" y="230" width="15" height="15" fill="#000000"/>
  
  <text x="135" y="205" font-family="'Inter', sans-serif" font-size="8" font-weight="800" fill="#4b5563">DIGITAL QR PASSKEY</text>
  <text x="135" y="222" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#3b82f6">LANE VERIFIED</text>
  <text x="135" y="240" font-family="'Inter', sans-serif" font-size="8.5" fill="#f3f4f6">Encrypted signature auto matches</text>
  <text x="135" y="254" font-family="'Inter', sans-serif" font-size="8.5" fill="#f3f4f6">scale weigh database logs</text>
</svg>
            `);

        case 'manage-stock':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#f59e0b" stroke-width="2"/>
  <defs>
    <radialGradient id="amberGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#amberGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">LIVE INVENTORY LEVEL LEDGER</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#f59e0b" text-anchor="middle">LIVE COUNTERS</text>

  <!-- Stock Item Details -->
  <rect x="20" y="55" width="360" height="52" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="85" font-family="'Inter', sans-serif" font-size="17">📦</text>
  <text x="65" y="78" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">Standard plastic crates</text>
  <text x="65" y="93" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#d97706">4,000 Pcs stored • Unit weight: 1.2 kg</text>
  <rect x="295" y="68" width="70" height="22" rx="6" fill="#7c2d12"/>
  <text x="330" y="81" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#f97316" text-anchor="middle">CRITICAL MIN</text>

  <rect x="20" y="118" width="360" height="52" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="148" font-family="'Inter', sans-serif" font-size="17">🧪</text>
  <text x="65" y="141" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">NPK Organic Fertilizer Compound</text>
  <text x="65" y="156" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#059669">1,200 Kg stored • High Nitrogen</text>
  <rect x="295" y="131" width="70" height="22" rx="6" fill="#064e3b"/>
  <text x="330" y="144" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#10b981" text-anchor="middle">STABLE LEVEL</text>

  <rect x="20" y="180" width="360" height="52" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="210" font-family="'Inter', sans-serif" font-size="17">🍇</text>
  <text x="65" y="203" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">A-Class Saperavi Produce</text>
  <text x="65" y="218" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#06b6d4">14,350 Kg • Cold Storage Storage</text>
  <rect x="295" y="193" width="70" height="22" rx="6" fill="#172554"/>
  <text x="330" y="206" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#3b82f6" text-anchor="middle">HARVEST LOG</text>

  <!-- Progress Indicators -->
  <text x="20" y="254" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#64748b">WAREHOUSE UTILIZATION RATIO</text>
  <text x="380" y="254" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#e2e8f0" text-anchor="end">32% OF TOTAL SPACE</text>
  <rect x="20" y="262" width="360" height="6" rx="3" fill="#1e293b"/>
  <rect x="20" y="262" width="115" height="6" rx="3" fill="#f59e0b"/>
</svg>
            `);

        case 'harvest-session':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#6366f1" stroke-width="2"/>
  <defs>
    <radialGradient id="indigoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#indigoGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">HARVEST RUNTIME SCHEDULER</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1"/>
  <circle cx="298" cy="27" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="0.5"/>
  <text x="306" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#f87171">RUNNING LIVE</text>

  <!-- Big Clock -->
  <rect x="20" y="55" width="360" height="100" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
  <text x="200" y="90" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900" fill="#475569" text-anchor="middle" letter-spacing="1.5">ELAPSED ACTIVE SESSION SESSION</text>
  <text x="200" y="132" font-family="'JetBrains Mono', monospace" font-size="34" font-weight="950" fill="#818cf8" text-anchor="middle" letter-spacing="2">04:12:35</text>

  <!-- Stats Grid -->
  <rect x="20" y="168" width="175" height="55" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="188" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280">ACTIVE WEIGHING TEAM</text>
  <text x="32" y="208" font-family="'Inter', sans-serif" font-size="13" font-weight="950" fill="#ffffff">22 Registered</text>
  <text x="180" y="208" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#10b981" text-anchor="end">verified logins</text>

  <rect x="205" y="168" width="175" height="55" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="217" y="188" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280">TARGET BOUNDARY PLOT</text>
  <text x="217" y="208" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#ffffff">Sector B (Row 1-12)</text>
  <text x="365" y="208" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#38bdf8" text-anchor="end">Saperavi</text>

  <!-- Session Information Bar -->
  <rect x="20" y="236" width="360" height="42" rx="8" fill="#1e1b4b" stroke="#3730a3" stroke-width="0.75"/>
  <text x="35" y="261" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#c084fc">CRITICAL INSTRUCTIONS:</text>
  <text x="155" y="261" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#e2e8f0">Maintain standard crate tare weight at 1.25 kg net.</text>
</svg>
            `);

        case 'live-monitoring':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#3b82f6" stroke-width="2"/>
  <defs>
    <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#blueGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">REAL-TIME WEIGH ACTIVITY ANALYTICS</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#3b82f6" text-anchor="middle">LIVE PULSES</text>

  <!-- Dashboard 3 widgets -->
  <rect x="20" y="55" width="112" height="55" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="30" y="72" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">TOTAL YIELD VALUE</text>
  <text x="30" y="94" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#10b981">28,700 GEL</text>

  <rect x="144" y="55" width="112" height="55" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="154" y="72" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">OPERATIONAL OPEX</text>
  <text x="154" y="94" font-family="'Inter8', sans-serif" font-size="12" font-weight="950" fill="#ef4444">2,612 GEL</text>

  <rect x="268" y="55" width="112" height="55" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="278" y="72" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">ESTIMATED NET VALUE</text>
  <text x="278" y="94" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#60a5fa">26,087 GEL</text>

  <!-- Live Chart Widget -->
  <rect x="20" y="122" width="360" height="155" rx="12" fill="#111827" stroke="#1f2937"/>
  <text x="35" y="145" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#64748b">PICKER LANE PRODUCTIVITY INDEX (crates/hour)</text>
  <text x="365" y="145" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#10b981" text-anchor="end">PEAK HARVEST RATE</text>

  <!-- Simulated Bar Graph -->
  <rect x="45" y="240" rx="2" width="25" height="40" fill="#4f46e5"/>
  <rect x="85" y="210" rx="2" width="25" height="70" fill="#4f46e5"/>
  <rect x="125" y="225" rx="2" width="25" height="55" fill="#4f46e5"/>
  <rect x="165" y="190" rx="2" width="25" height="90" fill="#4f46e5" />
  <rect x="205" y="180" rx="2" width="25" height="100" fill="#10b981"/>
  <rect x="245" y="195" rx="2" width="25" height="85" fill="#10b981"/>
  <rect x="285" y="215" rx="2" width="25" height="65" fill="#10b981"/>
  <rect x="325" y="235" rx="2" width="25" height="45" fill="#60a5fa"/>

  <line x1="35" y1="280" x2="365" y2="280" stroke="#374151" stroke-width="1.5"/>

  <!-- Hour Marks below chart -->
  <text x="57" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">08:00</text>
  <text x="97" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">09:00</text>
  <text x="137" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">10:00</text>
  <text x="177" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">11:00</text>
  <text x="217" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">12:00</text>
  <text x="257" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">13:00</text>
  <text x="297" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">14:00</text>
  <text x="337" y="291" font-family="'Inter', sans-serif" font-size="7" font-weight="800" fill="#6b7280" text-anchor="middle">15:00</text>
</svg>
            `);

        case 'weigh-station':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#10b981" stroke-width="2"/>
  <defs>
    <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#greenGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">INTEGRATED SCALE CONTROLLER</text>
  <rect x="295" y="18" width="85" height="18" rx="9" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1"/>
  <text x="337" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#10b981" text-anchor="middle">SCALE LOCKED</text>

  <!-- Big LCD Weigh Scale Indicator -->
  <rect x="20" y="55" width="360" height="92" rx="16" fill="#000000" stroke="#065f46" stroke-width="2"/>
  <text x="35" y="74" font-family="'JetBrains Mono', monospace" font-size="7" font-weight="800" fill="#047857" letter-spacing="1.5">STABLE SIGNAL INDICATION • SERIAL FEED CHANNEL 01</text>
  
  <text x="200" y="118" font-family="'JetBrains Mono', monospace" font-size="32" font-weight="950" fill="#34d399" text-anchor="middle" letter-spacing="-1">24.12 KG</text>
  <text x="365" y="134" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="900" fill="#059669" text-anchor="end">TARE CRATE: -1.25 KG</text>

  <!-- Scanned Employee Metadata Box -->
  <rect x="20" y="162" width="360" height="115" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  
  <text x="35" y="185" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#4b5563">SCAN-ID SYSTEM TELEMETRY</text>
  <rect x="288" y="172" width="75" height="18" rx="6" fill="#1e3a8a" stroke="#2563eb" stroke-width="0.5"/>
  <text x="325" y="184" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#60a5fa" text-anchor="middle">READY TO SYNC</text>

  <text x="35" y="210" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#9ca3af">Lane Active ID:</text>
  <text x="145" y="210" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="900" fill="#ffffff">ID: LB-2026-9A</text>

  <text x="35" y="230" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#9ca3af">Picker Registered:</text>
  <text x="145" y="230" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#34d399">Lado Beridze ( Kakheti Team )</text>

  <text x="35" y="250" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#9ca3af">Net Yield Recorded:</text>
  <text x="145" y="250" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">22.87 kg net <tspan font-size="8.5" fill="#9ca3af">stored in transaction log</tspan></text>
</svg>
            `);

        case 'storage-market':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#64748b" stroke-width="2"/>
  <defs>
    <radialGradient id="slateGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#64748b" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#slateGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">COLD STORAGE & TRADE DESK</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(100, 116, 139, 0.15)" stroke="rgba(100, 116, 139, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#94a3b8" text-anchor="middle">ACTIVE TRADE</text>

  <!-- Commodity Preview -->
  <rect x="20" y="55" width="360" height="60" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="93" font-family="'Inter', sans-serif" font-size="24">🍇</text>
  <text x="75" y="80" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#ffffff">Saperavi Grape (Class-A Premium)</text>
  <text x="75" y="98" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#10b981">Assigned to Cold Storage Lane #04 • Zone Temp: 2.2°C</text>

  <!-- Price Tenders list -->
  <rect x="20" y="130" width="360" height="98" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  
  <text x="35" y="153" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#4b5563">LIVE DISTRIBUTOR MARKETPLACE COMMODITY TENDERS</text>
  
  <line x1="35" y1="165" x2="365" y2="165" stroke="#1f2937" stroke-width="1"/>

  <text x="35" y="184" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#9ca3af">Tbilisi Winery Ltd.</text>
  <text x="365" y="184" font-family="'Inter', sans-serif" font-size="11" font-weight="800" fill="#9ca3af" text-anchor="end">2.65 GEL/kg</text>

  <rect x="28" y="196" width="344" height="24" rx="6" fill="#064e3b" stroke="rgba(16, 185, 129, 0.25)" stroke-width="1"/>
  <text x="35" y="212" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#e2e8f0">Kakheti Cellars & Distilleries</text>
  <text x="365" y="212" font-family="'Inter', sans-serif" font-size="11" font-weight="950" fill="#34d399" text-anchor="end">2.80 GEL/kg [WON]</text>

  <!-- Bottom Ledger note -->
  <rect x="20" y="242" width="360" height="38" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="200" y="265" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#94a3b8" text-anchor="middle">Auto-reconciled in Enterprise Ledger upon delivery confirmation</text>
</svg>
            `);

        case 'purchase-orders':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#f97316" stroke-width="2"/>
  <defs>
    <radialGradient id="orangeGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#orangeGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">MATERIALS PROCUREMENT PORTAL</text>
  <rect x="285" y="18" width="95" height="18" rx="9" fill="rgba(249, 115, 22, 0.15)" stroke="rgba(249, 115, 22, 0.3)" stroke-width="1"/>
  <text x="332" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fb923c" text-anchor="middle">APPROVED PO</text>

  <!-- Procurement Tabular list view -->
  <rect x="20" y="55" width="360" height="155" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="80" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#ffffff">PO-2026-88B</text>
  <rect x="300" y="66" width="65" height="18" rx="5" fill="#064e3b" stroke="rgba(16, 185, 129, 0.2)" stroke-width="0.5"/>
  <text x="332" y="78" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900" fill="#34d399" text-anchor="middle">Delivered</text>
  
  <line x1="35" y1="95" x2="365" y2="95" stroke="#1f2937" stroke-width="1"/>

  <text x="35" y="115" font-family="'Inter', sans-serif" font-size="9" font-weight="850" fill="#9ca3af">Supplier Dealer:</text>
  <text x="145" y="115" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#e2e8f0">Agro-Chemicals Georgia Ltd.</text>

  <text x="35" y="135" font-family="'Inter', sans-serif" font-size="9" font-weight="850" fill="#9ca3af">Procured Items:</text>
  <text x="145" y="135" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#ffffff">40 Bags NPK Compound, 12L fungicides</text>

  <text x="35" y="155" font-family="'Inter', sans-serif" font-size="9" font-weight="850" fill="#9ca3af">Total PO Pricing:</text>
  <text x="145" y="155" font-family="'Inter', sans-serif" font-size="11" font-weight="950" fill="#f97316">4,200 GEL <tspan font-size="8.5" font-weight="700" fill="#9ca3af">• Charged to Ledger</tspan></text>

  <rect x="35" y="172" width="330" height="24" rx="6" fill="#1c1917" stroke="#444" stroke-width="0.5"/>
  <text x="45" y="187" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#fb923c">✓ Live stock inventory levels automatically updated in Section 5 Silo</text>

  <!-- Small Footer Box -->
  <rect x="20" y="222" width="360" height="58" rx="8" fill="#1e293b" stroke="#334155" stroke-width="0.75"/>
  <text x="200" y="244" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#94a3b8" text-anchor="middle">Procurement logs require Super Admin approval signatures</text>
  <text x="200" y="262" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#94a3b8" text-anchor="middle">to release LLC double-entry financial funds</text>
</svg>
            `);

        case 'smart-sensors':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#10b981" stroke-width="2"/>
  <defs>
    <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#greenGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">AGRONOMY IOT PRO SENSORY FEED</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1"/>
  <circle cx="298" cy="27" r="3" fill="#10b981" class="animate-pulse"/>
  <text x="306" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#10b981">LIVE ONLINE</text>

  <!-- 2 Large gauges -->
  <rect x="20" y="55" width="175" height="135" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="107" y="78" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">SOIL MOISTURE LEVEL</text>
  <text x="107" y="125" font-family="'Inter', sans-serif" font-size="30" font-weight="950" fill="#60a5fa" text-anchor="middle">42.5%</text>
  <!-- Circular meter visualization simplified -->
  <path d="M 67 150 A 40 40 0 0 1 147 150" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
  <path d="M 67 150 A 40 40 0 0 1 130 148" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round"/>
  <text x="107" y="166" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#10b981" text-anchor="middle">OPTIMAL RANGE</text>

  <rect x="205" y="55" width="175" height="135" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="292" y="78" font-family="'Inter', sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">SOIL PH COEFFICIENT</text>
  <text x="292" y="125" font-family="'Inter', sans-serif" font-size="30" font-weight="950" fill="#f59e0b" text-anchor="middle">6.4 pH</text>
  <path d="M 252 150 A 40 40 0 0 1 332 150" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
  <path d="M 252 150 A 40 40 0 0 1 320 149" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
  <text x="292" y="166" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#10b981" text-anchor="middle">SLIGHTLY ACIDIC</text>

  <!-- Station location meta bar -->
  <rect x="20" y="210" width="360" height="70" rx="10" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="233" font-family="'Inter', sans-serif" font-weight="900" font-size="10" fill="#ffffff">Station #4 Sector B ( Grape Rkatsiteli )</text>
  <text x="35" y="250" font-family="'Inter', sans-serif" font-size="8.5" fill="#9ca3af">GPS Coordinates: 41.7241 N, 45.7952 E • Calibrated on May 12, 2026</text>
  <text x="35" y="264" font-family="'Inter', sans-serif" font-size="8.5" fill="#10b981" font-weight="800">✓ Real-time telemetry feed synched 1m ago • LoraWan wireless link healthy</text>
</svg>
            `);

        case 'field-works':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#14b8a6" stroke-width="2"/>
  <defs>
    <radialGradient id="tealGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#tealGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">PLANNER & FIELD TREATMENT LOG</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(20, 184, 166, 0.15)" stroke="rgba(20, 184, 166, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#14b8a6" text-anchor="middle">3 SCHEDULED</text>

  <!-- Task Calendar card items -->
  <rect x="20" y="55" width="360" height="48" rx="10" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="74" font-family="'Inter', sans-serif" font-size="10.5" font-weight="950" fill="#ffffff">Sprayer Chemical Treatment</text>
  <text x="35" y="88" font-family="'Inter', sans-serif" font-size="8" fill="#9ca3af">Sector A1-A4 Saperavi • Tractor Operator: G. Aladashvili</text>
  <rect x="295" y="68" width="70" height="18" rx="5" fill="#422006"/>
  <text x="330" y="80" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900" fill="#fbbf24" text-anchor="middle">Planned • 14 Jun</text>

  <rect x="20" y="112" width="360" height="48" rx="10" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="131" font-family="'Inter', sans-serif" font-size="10.5" font-weight="950" fill="#ffffff">Nursery Drip Line Inspection</text>
  <text x="35" y="145" font-family="'Inter', sans-serif" font-size="8" fill="#9ca3af">Sector C Hazelnut Nursery • Irrigations Supervisor: D. Japaridze</text>
  <rect x="295" y="125" width="70" height="18" rx="5" fill="#064e3b"/>
  <text x="330" y="137" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900" fill="#34d399" text-anchor="middle">Ready • Today</text>

  <rect x="20" y="169" width="360" height="48" rx="10" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="188" font-family="'Inter', sans-serif" font-size="10.5" font-weight="950" fill="#ffffff">Harvest Path Clearing & Mowing</text>
  <text x="35" y="202" font-family="'Inter', sans-serif" font-size="8" fill="#9ca3af">Inter-row Alleyways • Operations Team B</text>
  <rect x="295" y="182" width="70" height="18" rx="5" fill="#1e293b"/>
  <text x="330" y="194" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900" fill="#9ca3af" text-anchor="middle">Drafted</text>

  <rect x="20" y="228" width="360" height="52" rx="10" fill="#134e4a" stroke="rgba(20, 184, 166, 0.3)" stroke-width="1"/>
  <text x="35" y="248" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#2dd4bf">AUTOMATED SYSTEM ALERT:</text>
  <text x="35" y="264" font-family="'Inter', sans-serif" font-size="8" fill="#e2e8f0">Planner engine releases automatic SMS notifications to assigned field crews</text>
</svg>
            `);

        case 'payroll-balance':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#f43f5e" stroke-width="2"/>
  <defs>
    <radialGradient id="roseGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#roseGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">HARVEST PIECE-RATE PAYROLL LEDGER</text>
  <rect x="290" y="18" width="90" height="18" rx="9" fill="rgba(244, 63, 94, 0.15)" stroke="rgba(244, 63, 94, 0.3)" stroke-width="1"/>
  <text x="335" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fb7185" text-anchor="middle">RECONCILED</text>

  <!-- Big Slip details container -->
  <rect x="20" y="55" width="360" height="152" rx="12" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <text x="35" y="78" font-family="'Inter', sans-serif" font-size="8" font-weight="800" fill="#4b5563">GEL BANK RECIPIENT ALLOCATION SLIP</text>
  
  <line x1="35" y1="88" x2="365" y2="88" stroke="#1f2937" stroke-width="1"/>

  <text x="35" y="110" font-family="'Inter', sans-serif" font-size="9.5" fill="#9ca3af">RECIPIENT FULL NAME:</text>
  <text x="175" y="110" font-family="'Inter', sans-serif" font-size="10.5" font-weight="950" fill="#ffffff">Lado Beridze (Picker Lane 4)</text>

  <text x="35" y="130" font-family="'Inter', sans-serif" font-size="9.5" fill="#9ca3af">TOTAL NET WEIGH HARVESTED:</text>
  <text x="175" y="130" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="950" fill="#ffffff">245.50 kg net weight</text>

  <text x="35" y="150" font-family="'Inter', sans-serif" font-size="9.5" fill="#9ca3af">PIECE-RATE INDEX MULTIPLIER:</text>
  <text x="175" y="150" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="950" fill="#ffffff">0.45 GEL per kg</text>

  <line x1="35" y1="165" x2="365" y2="165" stroke="#1f2937" stroke-dasharray="3,3" stroke-width="1"/>

  <text x="35" y="188" font-family="'Inter', sans-serif" font-size="10.5" font-weight="950" fill="#f43f5e">TOTAL GROSS PAYOUT VALUE:</text>
  <text x="175" y="188" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="950" fill="#f43f5e">110.48 GEL net</text>

  <!-- Export Bar -->
  <rect x="20" y="218" width="360" height="62" rx="10" fill="#1e1b4b" stroke="rgba(244, 63, 94, 0.2)" stroke-width="1"/>
  <text x="35" y="238" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900" fill="#f472b6">EXCEL BANK BANK FILE EXPORT GENERATOR:</text>
  <text x="35" y="254" font-family="'Inter', sans-serif" font-size="8" fill="#e2e8f0">System bundles 14 verified picker pay records into Georgia Bank formats</text>
  <text x="35" y="267" font-family="'Inter', sans-serif" font-size="8" fill="#e2e8f0">for immediate business payroll processing.</text>
</svg>
            `);

        case 'company-ledger':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#fbbf24" stroke-width="2"/>
  <defs>
    <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#goldGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">LLC DOUBLE-ENTRY TRANSACTION LEDGER</text>
  <rect x="285" y="18" width="95" height="18" rx="9" fill="rgba(251, 191, 36, 0.15)" stroke="rgba(251, 191, 36, 0.3)" stroke-width="1"/>
  <text x="332" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fbbf24" text-anchor="middle">VERIFIED LEDGER</text>

  <!-- Small ledger log lines -->
  <rect x="20" y="55" width="360" height="34" rx="8" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="75" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#ef4444">DEBIT</text>
  <text x="80" y="75" font-family="'Inter', sans-serif" font-size="9" fill="#e2e8f0">Harvest Piece-Rate Compensation Lane 4</text>
  <text x="365" y="75" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="900" fill="#ef4444" text-anchor="end">-1,120.50 GEL</text>

  <rect x="20" y="96" width="360" height="34" rx="8" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="116" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#10b981">CREDIT</text>
  <text x="80" y="116" font-family="'Inter', sans-serif" font-size="9" fill="#e2e8f0">Fruit Sales Settlement - Tbilisi Winery Partner</text>
  <text x="365" y="116" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="900" fill="#10b981" text-anchor="end">+14,500.00 GEL</text>

  <rect x="20" y="137" width="360" height="34" rx="8" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="157" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#3b82f6">CAPITAL</text>
  <text x="80" y="157" font-family="'Inter', sans-serif" font-size="9" fill="#e2e8f0">Registered Partner Equity Deposit Giorgi Nishn.</text>
  <text x="365" y="157" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="900" fill="#60a5fa" text-anchor="end">+40,000.00 GEL</text>

  <!-- General administrative operating balances -->
  <rect x="20" y="185" width="175" height="42" rx="8" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="202" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">OPERATING LLC BALANCE</text>
  <text x="32" y="221" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#ffffff">54,120 GEL</text>

  <rect x="205" y="185" width="175" height="42" rx="8" fill="#111827" stroke="#1f2937"/>
  <text x="217" y="202" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">GEL BANK DESK DESCRIPTOR</text>
  <text x="217" y="221" font-family="'Inter', sans-serif" font-size="12" font-weight="950" fill="#10b981">ACTIVE DESK</text>

  <rect x="20" y="236" width="360" height="44" rx="8" fill="#1e293b" stroke="#334155" stroke-width="0.75"/>
  <text x="200" y="254" font-family="'Inter', sans-serif" font-size="8.2" font-weight="800" fill="#94a3b8" text-anchor="middle">Ledger maintains legal compliance with GAAP standards for LLC registers</text>
  <text x="200" y="268" font-family="'Inter', sans-serif" font-size="8.2" font-weight="800" fill="#94a3b8" text-anchor="middle">and auto-reconciles stock purchase order acquisitions.</text>
</svg>
            `);

        case 'ai-coordinator':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#6366f1" stroke-width="2"/>
  <defs>
    <radialGradient id="indigoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#indigoGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">AGRO AI DIAGNOSTIC COORDINATOR</text>
  <rect x="295" y="18" width="85" height="18" rx="9" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.3)" stroke-width="1"/>
  <text x="337" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="950" fill="#818cf8" text-anchor="middle">LLM GROUNDING</text>

  <!-- LLM Query window -->
  <rect x="20" y="55" width="360" height="85" rx="12" fill="#111827" stroke="#4f46e5" stroke-dasharray="2,2" stroke-width="1"/>
  <text x="35" y="74" font-family="'Inter', sans-serif" font-size="9" font-weight="900" fill="#818cf8">✦ CHAT ENTRY COMMAND PROMPT</text>
  <text x="35" y="93" font-family="'Inter', sans-serif" font-size="11" font-flow="italic" font-weight="700" fill="#e2e8f0">"Analyze Picker lane efficiency in Sector B Saperavi.</text>
  <text x="35" y="110" font-family="'Inter', sans-serif" font-size="11" font-flow="italic" font-weight="700" fill="#e2e8f0">Suggest standard crate tare variance index based on soil content."</text>
  <rect x="330" y="65" width="38" height="16" rx="4" fill="rgba(99, 102, 241, 0.2)"/>
  <text x="349" y="76" font-family="'Inter', sans-serif" font-size="7.5" fill="#a5b4fc" text-anchor="middle" font-weight="900">GPS OK</text>

  <!-- LLM Answer window -->
  <rect x="20" y="152" width="360" height="128" rx="12" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="35" y="174" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" fill="#e2e8f0">💡 CHAT ADVISORY INSIGHT VALUE:</text>
  
  <text x="35" y="196" font-family="'Inter', sans-serif" font-size="9" fill="#9ca3af">Lane 4 shows <tspan fill="#34d399" font-weight="900">12% speed increase</tspan> over average. Standard crate tare</text>
  <text x="35" y="211" font-family="'Inter', sans-serif" font-size="9" fill="#9ca3af">weight is stable at <tspan fill="#38bdf8" font-weight="900">1.25 kg</tspan>. Recommend digital scale lock mechanism</text>
  <text x="35" y="226" font-family="'Inter', sans-serif" font-size="9" fill="#9ca3af">to prevent sand weight contamination. Soil moisture index suggests grape</text>
  <text x="35" y="241" font-family="'Inter', sans-serif" font-size="9" fill="#9ca3af">sugar accumulation rate at <tspan fill="#fbbf24" font-weight="900">22.4 Brix</tspan>.</text>

  <rect x="35" y="254" width="330" height="16" rx="4" fill="#1e1b4b"/>
  <text x="45" y="265" font-family="'Inter', sans-serif" font-size="8.2" font-weight="800" fill="#c084fc">Report parsed from localized Weather Station and Drone infrared readings.</text>
</svg>
            `);

        case 'offline-sync':
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#f43f5e" stroke-width="2"/>
  <defs>
    <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" rx="16" fill="url(#redGlow)"/>
  
  <text x="20" y="32" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">OFFLINE TRANSACTION BUFFER</text>
  <rect x="270" y="18" width="110" height="18" rx="9" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="1"/>
  <text x="325" y="30" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fbbf24" text-anchor="middle">OFFLINE BUFFER LOCK</text>

  <!-- Sync logs container -->
  <rect x="20" y="55" width="360" height="105" rx="16" fill="#180c0e" stroke="#ef4444" stroke-width="1.5"/>
  <text x="200" y="78" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#fca5a5" text-anchor="middle" letter-spacing="1.5">IDEMPOTENT SECURE SYNC BUFFER</text>
  <text x="200" y="118" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="950" fill="#fbbf24" text-anchor="middle" letter-spacing="-0.5">14 BATCHES CACHED</text>
  <text x="200" y="140" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#9ca3af" text-anchor="middle">Ready to safely transmit as soon as connection is re-established</text>

  <!-- System cache state indicators -->
  <rect x="20" y="172" width="175" height="52" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="32" y="191" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">SQLITE OFFLINE CACHE</text>
  <text x="32" y="210" font-family="'Inter', sans-serif" font-size="11" font-weight="950" fill="#34d399">ENGAGED</text>

  <rect x="205" y="172" width="175" height="52" rx="10" fill="#111827" stroke="#1f2937"/>
  <text x="217" y="191" font-family="'Inter', sans-serif" font-size="6.5" font-weight="800" fill="#6b7280">DATA TRANSACTION TOKEN</text>
  <text x="217" y="210" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="950" fill="#ffffff">IDMP-V2-SECURE</text>

  <!-- Alert notification about low coverage sync -->
  <rect x="20" y="235" width="360" height="45" rx="8" fill="#1c1917" stroke="#444" stroke-width="0.75"/>
  <circle cx="34" cy="257" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="0.5"/>
  <text x="46" y="260" font-family="'Inter', sans-serif" font-size="8.3" font-weight="800" fill="#9ca3af">Cellular signal weak: Transaction buffer active. Scale can weigh uninterrupted.</text>
</svg>
            `);

        default:
            return buildSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" rx="16" fill="#0b0f19" stroke="#1e293b" stroke-width="2"/>
  <text x="200" y="150" font-family="'Inter', sans-serif" font-size="14" font-weight="900" fill="#94a3b8" text-anchor="middle">AGRIMESH MODULE DETAIL SCREEN</text>
</svg>
            `);
    }
};
