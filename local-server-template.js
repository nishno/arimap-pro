/**
 * Agrimap Private Local Server Node Template
 * 
 * This is a lightweight Node.js + Express server that runs on a local computer
 * on the plantation's WiFi network. It acts as an offline backup sink,
 * receiving synchronized weighings and saving them directly to JSON files
 * or local storage, avoiding browser sandboxing limits.
 * 
 * To run this server:
 * 1. Install Node.js (https://nodejs.org)
 * 2. In a terminal, run:
 *    npm install express cors body-parser
 * 3. Save this file as `server.js` and start it with:
 *    node server.js
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const DEFAULT_PORT = 3000;

// Enable CORS and parsing of JSON payloads
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// 1. Connection Ping and Folder Test endpoint
app.get('/api/sync/test', (req, res) => {
    const dataFolder = req.query.folder || '';
    console.log(`🔌 Ping received. Data folder requested: "${dataFolder}"`);

    if (dataFolder) {
        try {
            // Check if folder exists or create it
            const resolvedPath = path.resolve(dataFolder);
            if (!fs.existsSync(resolvedPath)) {
                fs.mkdirSync(resolvedPath, { recursive: true });
                console.log(`📁 Created backup directory: ${resolvedPath}`);
            }
            return res.json({ 
                status: 'ok', 
                message: 'Local server is active and backup folder verified!',
                resolvedPath
            });
        } catch (err) {
            console.error(`❌ Folder verification failed for "${dataFolder}":`, err.message);
            return res.status(400).json({ 
                status: 'error', 
                message: `Failed to verify/create directory: ${err.message}` 
            });
        }
    }

    res.json({ status: 'ok', message: 'Local server node is active and reachable.' });
});

// 2. Synchronization and Mirror Duplicate-Write endpoint
app.post('/api/sync', (req, res) => {
    const { path: dbPath, type, data, deviceId, dataFolder, timestamp } = req.body;
    
    if (!dbPath) {
        return res.status(400).json({ error: 'Missing sync path parameters' });
    }

    console.log(`📥 Sync received: [${type.toUpperCase()}] for "${dbPath}" from Device: ${deviceId}`);

    // Determine saving location: fallback to local './agrimap_backup' if none specified
    const storageDir = dataFolder ? path.resolve(dataFolder) : path.join(__dirname, 'agrimap_backup');
    
    try {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Sanitize path to form a valid filename e.g. "harvestEntries_hent-1234.json"
        const safeFileName = dbPath.replace(/\//g, '_') + '.json';
        const fileFullPath = path.join(storageDir, safeFileName);

        if (type === 'delete') {
            if (fs.existsSync(fileFullPath)) {
                fs.unlinkSync(fileFullPath);
                console.log(`🗑️ Deleted local file: ${fileFullPath}`);
            }
        } else {
            // Write payload with timestamp and device meta information
            const payload = {
                synced_at_local: new Date().toISOString(),
                client_timestamp: timestamp,
                device_id: deviceId,
                collection_path: dbPath,
                operation: type,
                payload: data
            };

            fs.writeFileSync(fileFullPath, JSON.stringify(payload, null, 2), 'utf8');
            console.log(`💾 Saved local mirror file: ${fileFullPath}`);
        }

        res.json({ status: 'success', savedPath: fileFullPath });
    } catch (err) {
        console.error(`❌ Sync Operation failed for "${dbPath}":`, err.message);
        res.status(500).json({ error: `Disk writing failed: ${err.message}` });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal server error occurred.' });
});

// Run server binding to all network interfaces on the machine
const startServer = () => {
    const port = process.env.PORT || DEFAULT_PORT;
    app.listen(port, '0.0.0.0', () => {
        console.log(`================================================================`);
        console.log(`🍇 agrimap Private Local Node initialized                       `);
        console.log(`📡 Server running on http://localhost:${port}                   `);
        console.log(`🌐 Accessible on local WiFi network at your computer's IP       `);
        console.log(`================================================================`);
    });
};

startServer();
