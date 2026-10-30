const axios = require('axios');
require('dotenv').config();

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!N8N_WEBHOOK_URL) {
    console.warn('[n8n Service] WARNING: N8N_WEBHOOK_URL is not set in environment. Webhook alerts will be skipped without crashing.');
}

/**
 * Sends absence alert payload to production n8n webhook.
 *
 * @param {Object} data
 * @param {string} data.employeeId - Employee identifier
 * @param {string} data.employeeName - Employee display name
 * @param {string} [data.cameraId] - Camera identifier (default: "CAM-1")
 * @param {string} [data.absentSince] - ISO 8601 timestamp string (default: current time)
 * @param {number} [data.thresholdSeconds] - Absence threshold in seconds (default: 10)
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
const sendAbsenceAlert = async (data = {}) => {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('[n8n Service] Skipping webhook call: N8N_WEBHOOK_URL is not configured.');
        return { ok: false, error: 'N8N_WEBHOOK_URL is not configured' };
    }

    const payload = {
        employeeId: String(data.employeeId !== undefined ? data.employeeId : ''),
        employeeName: String(data.employeeName !== undefined ? data.employeeName : 'Unknown'),
        cameraId: String(data.cameraId !== undefined ? data.cameraId : 'CAM-1'),
        absentSince: data.absentSince ? new Date(data.absentSince).toISOString() : new Date().toISOString(),
        thresholdSeconds: Number(data.thresholdSeconds !== undefined ? data.thresholdSeconds : 10)
    };

    try {
        const response = await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 second timeout
        });

        console.log(`[n8n Service] Alert sent successfully. HTTP Status: ${response.status}`, response.data);
        return { ok: true, data: response.data };
    } catch (error) {
        if (error.response) {
            console.error(`[n8n Service] Alert request failed. HTTP Status: ${error.response.status}`, error.response.data);
            const bodyStr = typeof error.response.data === 'object'
                ? JSON.stringify(error.response.data)
                : String(error.response.data);
            return {
                ok: false,
                error: `HTTP ${error.response.status}: ${bodyStr}`
            };
        } else {
            console.error('[n8n Service] Alert request failed. Error:', error.message);
            return {
                ok: false,
                error: error.message
            };
        }
    }
};

/**
 * Backward compatibility helper for legacy notifyAbsence calls.
 */
const notifyAbsence = async (employeeId, name, confidence, options = {}) => {
    const result = await sendAbsenceAlert({
        employeeId,
        employeeName: name,
        cameraId: options.cameraId || 'CAM-1',
        absentSince: options.absentSince || new Date().toISOString(),
        thresholdSeconds: options.thresholdSeconds !== undefined ? options.thresholdSeconds : 10
    });

    return {
        success: result.ok,
        ok: result.ok,
        data: result.data,
        error: result.error
    };
};

module.exports = {
    sendAbsenceAlert,
    notifyAbsence
};
