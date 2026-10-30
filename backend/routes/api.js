const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { sendAbsenceAlert, notifyAbsence } = require('../services/n8nService');

// GET /api/employees
router.get('/employees', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM employees');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id
router.get('/employees/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Employee not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/attendance
router.get('/attendance', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT a.*, e.name as "employeeName" 
            FROM attendance a 
            JOIN employees e ON a."employeeId" = e.id
            ORDER BY a.date DESC, a."lastDetectedAt" DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/detections
router.get('/detections', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT d.*, e.name as "employeeName" 
            FROM detections d
            JOIN employees e ON d."employeeId" = e.id
            ORDER BY d.timestamp DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications
router.get('/notifications', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT n.*, e.name as "employeeName" 
            FROM notifications n
            JOIN employees e ON n."employeeId" = e.id
            ORDER BY n.timestamp DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const totalEmpRes = await db.query('SELECT COUNT(*) as count FROM employees');
        const totalEmployees = parseInt(totalEmpRes.rows[0]?.count || 0, 10);
        const today = new Date().toISOString().split('T')[0];
        
        // Present employees based on today's attendance status
        const presentEmpRes = await db.query(`
            SELECT COUNT(*) as count FROM attendance 
            WHERE date = $1 AND status = 'PRESENT'
        `, [today]);
        const presentCount = parseInt(presentEmpRes.rows[0]?.count || 0, 10);

        res.json({
            totalEmployees,
            presentEmployees: presentCount,
            absentEmployees: totalEmployees - presentCount,
            attendancePercentage: totalEmployees > 0 ? parseFloat(((presentCount / totalEmployees) * 100).toFixed(2)) : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/test-alert
router.post('/test-alert', async (req, res) => {
    try {
        const dummyData = {
            employeeId: req.body?.employeeId || 'EMP-001',
            employeeName: req.body?.employeeName || 'Ravi Kumar',
            cameraId: req.body?.cameraId || 'CAM-3',
            absentSince: req.body?.absentSince || new Date().toISOString(),
            thresholdSeconds: req.body?.thresholdSeconds !== undefined ? Number(req.body.thresholdSeconds) : 10
        };

        const result = await sendAbsenceAlert(dummyData);
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /api/notifications/test
router.post('/notifications/test', async (req, res) => {
    const { employeeId, employeeName } = req.body;
    const now = new Date().toISOString();
    try {
        const result = await notifyAbsence(employeeId || 'EMP001', employeeName || 'Test User', 0.9);
        
        const n8nResponseStr = result.success ? JSON.stringify(result.data) : result.error || 'Automation unavailable';
        const status = result.success ? 'PENDING' : 'FAILED';
        
        await db.query(`
            INSERT INTO notifications ("employeeId", "eventType", "n8nResponse", "whatsappStatus", "emailStatus", "callStatus", "absentAt") 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [employeeId || 'EMP001', 'EMPLOYEE_ABSENCE_TEST', n8nResponseStr, status, status, status, now]);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/:id/channel-sent (Callback endpoint for n8n)
router.post('/notifications/:id/channel-sent', async (req, res) => {
    const { id } = req.params;
    const { channel, sentAt } = req.body;

    const normalizedChannel = (channel || '').toString().toLowerCase();
    if (!['whatsapp', 'email', 'call'].includes(normalizedChannel)) {
        return res.status(400).json({ error: 'Invalid channel. Must be "whatsapp", "email", or "call".' });
    }

    const timestamp = sentAt || new Date().toISOString();

    let queryText = '';
    if (normalizedChannel === 'whatsapp') {
        queryText = `
            UPDATE notifications 
            SET "whatsappStatus" = 'SENT', "whatsappSentAt" = $1
            WHERE id = $2
            RETURNING *
        `;
    } else if (normalizedChannel === 'email') {
        queryText = `
            UPDATE notifications 
            SET "emailStatus" = 'SENT', "emailSentAt" = $1
            WHERE id = $2
            RETURNING *
        `;
    } else if (normalizedChannel === 'call') {
        queryText = `
            UPDATE notifications 
            SET "callStatus" = 'SENT', "callSentAt" = $1
            WHERE id = $2
            RETURNING *
        `;
    }

    try {
        const { rows } = await db.query(queryText, [timestamp, id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
