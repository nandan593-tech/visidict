import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Users, UserCheck, UserMinus, Activity, Radio, Camera } from 'lucide-react';
import Intro from '../components/Intro';
import StatusBadge from '../components/StatusBadge';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const API_URL = `${SOCKET_URL}/api`;

const CAMERAS = [
  { id: 'CAM1', label: 'CAM 1' },
  { id: 'CAM2', label: 'CAM 2' },
  { id: 'CAM3', label: 'CAM 3' },
];

const DUMMY_DASHBOARD_STATS = {
  totalEmployees: 8,
  presentEmployees: 5,
  absentEmployees: 3,
  attendancePercentage: 62.5,
};

const DUMMY_DASHBOARD_HISTORY = [
  { id: 1, employeeId: 'EMP001', employeeName: 'Dr. Rajesh Sharma', timestamp: new Date(Date.now() - 2 * 60000).toISOString(), detected: 1, cameraId: 'CAM1' },
  { id: 2, employeeId: 'EMP004', employeeName: 'Vikram Malhotra', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), detected: 1, cameraId: 'CAM2' },
  { id: 3, employeeId: 'EMP002', employeeName: 'Priya Venkatesh', timestamp: new Date(Date.now() - 8 * 60000).toISOString(), detected: 1, cameraId: 'CAM1' },
  { id: 4, employeeId: 'EMP006', employeeName: 'Sneha Patil', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), detected: 1, cameraId: 'CAM3' },
  { id: 5, employeeId: 'EMP007', employeeName: 'Amitav Ghosh', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), detected: 1, cameraId: 'CAM2' },
  { id: 6, employeeId: 'EMP003', employeeName: 'Ananya Deshmukh', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), detected: 0, cameraId: 'CAM1' },
  { id: 7, employeeId: 'EMP005', employeeName: 'Karthik Subramanian', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), detected: 0, cameraId: 'CAM3' },
];

const DUMMY_DASHBOARD_NOTIFICATIONS = [
  { id: 1, employeeId: 'EMP003', employeeName: 'Ananya Deshmukh', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), whatsappStatus: 'DELIVERED', emailStatus: 'DELIVERED', callStatus: 'COMPLETED' },
  { id: 2, employeeId: 'EMP005', employeeName: 'Karthik Subramanian', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), whatsappStatus: 'DELIVERED', emailStatus: 'DELIVERED', callStatus: 'PENDING' },
  { id: 3, employeeId: 'EMP008', employeeName: 'Neha Choudhury', timestamp: new Date(Date.now() - 35 * 60000).toISOString(), whatsappStatus: 'DELIVERED', emailStatus: 'DELIVERED', callStatus: 'FAILED' },
];

export default function Dashboard() {
  const location = useLocation();
  const [introDone, setIntroDone] = useState(() => {
    // If navigating from login with playIntro: true, play intro
    if (location.state?.playIntro) {
      return false;
    }
    return sessionStorage.getItem('visidict_dashboard_intro_done') === 'true';
  });

  const [selectedCamera, setSelectedCamera] = useState('CAM1');

  const [dashboardData, setDashboardData] = useState(DUMMY_DASHBOARD_STATS);
  const [feedState, setFeedState] = useState({
    hasFeed: false,
    status: 'CHECKING',
    confidence: 0,
    employeeId: '',
    cameraId: null,
  });
  const [history, setHistory] = useState(DUMMY_DASHBOARD_HISTORY);
  const [notifications, setNotifications] = useState(DUMMY_DASHBOARD_NOTIFICATIONS);

  const socketRef = useRef(null);
  const videoImgRef = useRef(null);
  const lastFeedStateRef = useRef(feedState);
  const lastHudUpdateRef = useRef(0);

  const fetchDashboard = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/dashboard`);
      if (data && typeof data.totalEmployees === 'number' && data.totalEmployees > 0) {
        setDashboardData(data);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/detections`);
      if (data && data.length > 0) {
        setHistory(data.slice(0, 10)); // Just show recent 10
      }
    } catch (e) {
      console.error('Failed to fetch detection history:', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/notifications`);
      if (data && data.length > 0) {
        setNotifications(data.slice(0, 10));
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  const handleIntroComplete = () => {
    sessionStorage.setItem('visidict_dashboard_intro_done', 'true');
    setIntroDone(true);
  };

  useEffect(() => {
    fetchDashboard();
    fetchHistory();
    fetchNotifications();

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
    });

    socketRef.current.on('live_feed', (data) => {
      if (!data) return;

      // Update image directly without triggering full React DOM reconciliation tree re-render
      if (videoImgRef.current && data.frame) {
        videoImgRef.current.src = data.frame;
      }

      const now = Date.now();
      const prev = lastFeedStateRef.current;
      const statusChanged = prev.status !== data.status || !prev.hasFeed;
      const shouldUpdateHud = statusChanged || (now - lastHudUpdateRef.current > 350);

      if (shouldUpdateHud) {
        lastHudUpdateRef.current = now;
        const nextState = {
          hasFeed: true,
          status: data.status || 'CHECKING',
          confidence: typeof data.confidence === 'number' ? data.confidence : 0,
          employeeId: data.employeeId || 'Unknown',
          cameraId: data.cameraId || null,
        };
        lastFeedStateRef.current = nextState;
        setFeedState(nextState);
      }

      if (data.justChanged) {
        fetchDashboard();
        fetchHistory();
      }
    });

    socketRef.current.on('notification_update', () => {
      fetchNotifications();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const activeCam = CAMERAS.find((c) => c.id === selectedCamera) || CAMERAS[0];

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (!item.cameraId) return true; // fallback when backend does not provide cameraId
      return item.cameraId === selectedCamera;
    });
  }, [history, selectedCamera]);

  return (
    <>
      {!introDone && <Intro onComplete={handleIntroComplete} />}

      <div className="dashboard-page">
        {/* Stats Cards - Aggregate across all cameras */}
        <div className="dashboard-grid">
          <StatCard
            icon={<Users size={24} color="var(--color-primary)" />}
            label="Total Employees"
            value={dashboardData.totalEmployees}
          />
          <StatCard
            icon={<UserCheck size={24} color="var(--status-present)" />}
            label="Present Today"
            value={dashboardData.presentEmployees}
          />
          <StatCard
            icon={<UserMinus size={24} color="var(--status-absent)" />}
            label="Absent Today"
            value={dashboardData.absentEmployees}
          />
          <StatCard
            icon={<Activity size={24} color="var(--color-primary)" />}
            label="Attendance %"
            value={`${dashboardData.attendancePercentage}%`}
          />
        </div>

        <div className="content-grid">
          {/* Left Column: Camera Switcher & Live AI Feed */}
          <div className="left-column">
            {/* Multi-Camera Selector UI */}
            <div
              className="camera-switcher"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              }}
            >
              {CAMERAS.map((camera) => {
                const isActive = selectedCamera === camera.id;
                return (
                  <button
                    key={camera.id}
                    type="button"
                    onClick={() => setSelectedCamera(camera.id)}
                    className={`camera-tab-pill ${isActive ? 'active' : ''}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 1.15rem',
                      borderRadius: '9999px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                      backgroundColor: isActive ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.85)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      borderColor: isActive ? 'var(--color-primary)' : 'var(--glass-border)',
                      boxShadow: isActive
                        ? '0 4px 14px -2px rgba(79, 70, 229, 0.45)'
                        : '0 2px 6px rgba(31, 41, 55, 0.03)',
                    }}
                  >
                    <Camera size={16} color={isActive ? '#ffffff' : 'var(--text-secondary)'} />
                    <span>{camera.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="glass-panel feed-container">
              <div className="feed-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Radio size={20} color="var(--color-primary)" />
                  <h2>📡 Live AI Feed — {activeCam.label}</h2>
                </div>
                <div className="live-indicator">
                  <div
                    className={`pulse ${feedState.status === 'ABSENT' ? 'absent' : ''}`}
                    style={feedState.status === 'ABSENT' ? { backgroundColor: 'var(--status-absent)' } : {}}
                  />
                  LIVE - {feedState.status || 'STANDBY'}
                </div>
              </div>

              <div style={{ position: 'relative', width: '100%' }}>
                <img
                  ref={videoImgRef}
                  alt={`Live feed from ${activeCam.label}`}
                  className="video-frame"
                  style={{
                    display: feedState.hasFeed ? 'block' : 'none',
                    width: '100%',
                    borderRadius: '12px',
                    objectFit: 'contain',
                    backgroundColor: '#1F2937',
                    contain: 'layout paint',
                    transform: 'translateZ(0)',
                  }}
                />
                {!feedState.hasFeed && (
                  <div
                    className="video-frame"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      color: 'var(--text-secondary)',
                      minHeight: '360px',
                    }}
                  >
                    <Camera size={36} style={{ opacity: 0.5 }} />
                    <span>Waiting for AI Service feed ({activeCam.label})...</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <span className="stat-label">Subject ID:</span> {feedState.employeeId || 'Unknown'}
                </div>
                <div>
                  <span className="stat-label">AI Confidence:</span>{' '}
                  {feedState.confidence ? `${(feedState.confidence * 100).toFixed(1)}%` : '--'}
                </div>
                <div>
                  <span className="stat-label">Camera:</span> {activeCam.label} ({activeCam.id})
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Detections & Automations */}
          <div className="right-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <RecentDetectionsPanel activeCamLabel={activeCam.label} filteredHistory={filteredHistory} />
            <AutomationsPanel notifications={notifications} />
          </div>
        </div>
      </div>
    </>
  );
}

const StatCard = React.memo(function StatCard({ icon, label, value }) {
  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
});

const RecentDetectionsPanel = React.memo(function RecentDetectionsPanel({ activeCamLabel, filteredHistory }) {
  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Recent Detections</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeCamLabel}</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Employee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
                <td>{item.employeeName}</td>
                <td>
                  <span className={`badge ${item.detected ? 'present' : 'absent'}`}>
                    {item.detected ? 'Detected' : 'Missed'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No detections yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

const AutomationsPanel = React.memo(function AutomationsPanel({ notifications }) {
  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <h3 style={{ marginBottom: '1rem' }}>n8n Automations</h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>WhatsApp</th>
              <th>Email</th>
              <th>Call</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.employeeName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </td>
                <td><StatusBadge status={item.whatsappStatus} /></td>
                <td><StatusBadge status={item.emailStatus} /></td>
                <td><StatusBadge status={item.callStatus} /></td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No recent alerts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

