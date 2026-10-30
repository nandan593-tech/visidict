require('dotenv').config();

if (!process.env.N8N_WEBHOOK_URL) {
    console.warn('[Startup Warning] N8N_WEBHOOK_URL is not configured in .env. Absence alerts will be skipped without crashing.');
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const db = require('./models/database');
const { sendAbsenceAlert } = require('./services/n8nService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Throttle map for attendance updates (key: employeeId, val: timestamp)
const lastAttUpdateTime = {};

// Track employees who have already been alerted for their current absence episode
const alertedEmployees = new Set();

// Socket.io for Real-time events
io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Receive data from Python AI Service
    socket.on('detection_frame', async (data) => {
        // data expected: { frame: "base64...", status: "PRESENT"|"ABSENT"|"CHECKING", employeeId: "...", confidence: 0.x }
        
        // Broadcast to web clients using volatile to immediately drop any stale/backlogged frames
        socket.broadcast.volatile.emit('live_feed', data);

        if (data.status && data.employeeId) {
            const date = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();
            const nowMs = Date.now();
            const lastUpdate = lastAttUpdateTime[data.employeeId] || 0;
            const timeSinceLastUpdate = nowMs - lastUpdate;

            // Reset "already alerted" flag when employee is detected present again
            if (data.status === 'PRESENT') {
                alertedEmployees.delete(data.employeeId);
            }

            // Trigger absence alert ONLY ONCE when crossing absence threshold
            if (data.status === 'ABSENT' && !alertedEmployees.has(data.employeeId)) {
                alertedEmployees.add(data.employeeId);

                // Fetch employee name
                let empName = 'Unknown';
                try {
                    const empRes = await db.query('SELECT name FROM employees WHERE id = $1', [data.employeeId]);
                    if (empRes.rows[0]) {
                        empName = empRes.rows[0].name;
                    }
                } catch (fetchErr) {
                    console.error('[DB Error fetching employee name]:', fetchErr.message);
                }

                console.log(`[Event] Absence confirmed for ${empName} (${data.employeeId}). Notifying n8n...`);
                const alertPayload = {
                    employeeId: data.employeeId,
                    employeeName: empName,
                    cameraId: data.cameraId || 'CAM-1',
                    absentSince: now,
                    thresholdSeconds: data.thresholdSeconds !== undefined ? Number(data.thresholdSeconds) : 10
                };

                const result = await sendAbsenceAlert(alertPayload);

                try {
                    const n8nResponseStr = result.ok
                        ? JSON.stringify(result.data)
                        : (result.error || 'Automation unavailable');
                    const notifStatus = result.ok ? 'PENDING' : 'FAILED';

                    await db.query(`
                        INSERT INTO notifications ("employeeId", "eventType", "n8nResponse", "whatsappStatus", "emailStatus", "callStatus", "absentAt") 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [data.employeeId, 'EMPLOYEE_ABSENCE', n8nResponseStr, notifStatus, notifStatus, notifStatus, now]);

                    // Broadcast notification update to frontend
                    io.emit('notification_update');
                } catch (notifErr) {
                    console.error('[DB Error in notifications record]:', notifErr.message);
                }
            }

            // Only run DB queries if status changed OR every 10 seconds for attendance heartbeat
            if (data.justChanged || timeSinceLastUpdate > 10000) {
                lastAttUpdateTime[data.employeeId] = nowMs;

                try {
                    // Track detections and attendance
                    if (data.status === 'PRESENT') {
                        // Upsert attendance record for PRESENT
                        await db.query(`
                            INSERT INTO attendance ("employeeId", date, status, "firstDetectedAt", "lastDetectedAt")
                            VALUES ($1, $2, 'PRESENT', $3, $3)
                            ON CONFLICT ("employeeId", date) DO UPDATE SET 
                                status = EXCLUDED.status,
                                "lastDetectedAt" = EXCLUDED."lastDetectedAt"
                        `, [data.employeeId, date, now]);
                        
                        if (data.justChanged || timeSinceLastUpdate > 10000) {
                            await db.query(
                                'INSERT INTO detections ("employeeId", detected, confidence) VALUES ($1, $2, $3)',
                                [data.employeeId, true, data.confidence || 0]
                            );
                        }
                    } 
                    else if (data.status === 'ABSENT' && data.justChanged) {
                        // Upsert attendance record for ABSENT, tracking absentAt
                        await db.query(`
                            INSERT INTO attendance ("employeeId", date, status, "firstDetectedAt", "lastDetectedAt", "absentAt")
                            VALUES ($1, $2, 'ABSENT', NULL, NULL, $3)
                            ON CONFLICT ("employeeId", date) DO UPDATE SET 
                                status = EXCLUDED.status,
                                "absentAt" = EXCLUDED."absentAt"
                        `, [data.employeeId, date, now]);
                    }
                } catch (err) {
                    console.error("[DB Error in detection_frame]:", err.message);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
