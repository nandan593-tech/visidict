import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  History as HistoryIcon,
  FileDown,
  RotateCw,
  CheckCircle2,
  FileSpreadsheet,
  Camera,
  Bell,
  ChevronLeft,
  ChevronRight,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import './History.css';

const API_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api`;
const DETECTIONS_PER_PAGE = 20;

export const DUMMY_EMPLOYEES = [
  { id: 'EMP001', name: 'Dr. Rajesh Sharma' },
  { id: 'EMP002', name: 'Priya Venkatesh' },
  { id: 'EMP003', name: 'Ananya Deshmukh' },
  { id: 'EMP004', name: 'Vikram Malhotra' },
  { id: 'EMP005', name: 'Karthik Subramanian' },
  { id: 'EMP006', name: 'Sneha Patil' },
  { id: 'EMP007', name: 'Amitav Ghosh' },
  { id: 'EMP008', name: 'Neha Choudhury' },
];

export const DUMMY_ATTENDANCE = [
  {
    id: 1,
    employeeId: 'EMP001',
    employeeName: 'Dr. Rajesh Sharma',
    date: '2026-09-11',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-11T09:02:14.000Z',
    lastDetectedAt: '2026-09-11T09:45:30.000Z',
  },
  {
    id: 2,
    employeeId: 'EMP002',
    employeeName: 'Priya Venkatesh',
    date: '2026-09-11',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-11T09:05:40.000Z',
    lastDetectedAt: '2026-09-11T09:42:10.000Z',
  },
  {
    id: 3,
    employeeId: 'EMP003',
    employeeName: 'Ananya Deshmukh',
    date: '2026-09-11',
    status: 'ABSENT',
    firstDetectedAt: null,
    lastDetectedAt: null,
  },
  {
    id: 4,
    employeeId: 'EMP004',
    employeeName: 'Vikram Malhotra',
    date: '2026-09-11',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-11T08:55:12.000Z',
    lastDetectedAt: '2026-09-11T09:46:00.000Z',
  },
  {
    id: 5,
    employeeId: 'EMP005',
    employeeName: 'Karthik Subramanian',
    date: '2026-09-11',
    status: 'ABSENT',
    firstDetectedAt: null,
    lastDetectedAt: null,
  },
  {
    id: 6,
    employeeId: 'EMP006',
    employeeName: 'Sneha Patil',
    date: '2026-09-11',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-11T09:12:05.000Z',
    lastDetectedAt: '2026-09-11T09:40:18.000Z',
  },
  {
    id: 7,
    employeeId: 'EMP007',
    employeeName: 'Amitav Ghosh',
    date: '2026-09-11',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-11T09:15:30.000Z',
    lastDetectedAt: '2026-09-11T09:35:22.000Z',
  },
  {
    id: 8,
    employeeId: 'EMP008',
    employeeName: 'Neha Choudhury',
    date: '2026-09-11',
    status: 'ABSENT',
    firstDetectedAt: null,
    lastDetectedAt: null,
  },
  // Yesterday's records
  {
    id: 9,
    employeeId: 'EMP001',
    employeeName: 'Dr. Rajesh Sharma',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T08:58:10.000Z',
    lastDetectedAt: '2026-09-10T17:30:15.000Z',
  },
  {
    id: 10,
    employeeId: 'EMP002',
    employeeName: 'Priya Venkatesh',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T09:02:10.000Z',
    lastDetectedAt: '2026-09-10T17:15:00.000Z',
  },
  {
    id: 11,
    employeeId: 'EMP003',
    employeeName: 'Ananya Deshmukh',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T09:10:00.000Z',
    lastDetectedAt: '2026-09-10T17:00:20.000Z',
  },
  {
    id: 12,
    employeeId: 'EMP004',
    employeeName: 'Vikram Malhotra',
    date: '2026-09-10',
    status: 'ABSENT',
    firstDetectedAt: null,
    lastDetectedAt: null,
  },
  {
    id: 13,
    employeeId: 'EMP005',
    employeeName: 'Karthik Subramanian',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T09:20:00.000Z',
    lastDetectedAt: '2026-09-10T17:45:10.000Z',
  },
  {
    id: 14,
    employeeId: 'EMP006',
    employeeName: 'Sneha Patil',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T08:50:00.000Z',
    lastDetectedAt: '2026-09-10T17:10:00.000Z',
  },
  {
    id: 15,
    employeeId: 'EMP007',
    employeeName: 'Amitav Ghosh',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T09:05:00.000Z',
    lastDetectedAt: '2026-09-10T17:20:00.000Z',
  },
  {
    id: 16,
    employeeId: 'EMP008',
    employeeName: 'Neha Choudhury',
    date: '2026-09-10',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-10T09:00:00.000Z',
    lastDetectedAt: '2026-09-10T17:05:00.000Z',
  },
  // Day before yesterday
  {
    id: 17,
    employeeId: 'EMP001',
    employeeName: 'Dr. Rajesh Sharma',
    date: '2026-09-09',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-09T09:01:00.000Z',
    lastDetectedAt: '2026-09-09T17:25:00.000Z',
  },
  {
    id: 18,
    employeeId: 'EMP002',
    employeeName: 'Priya Venkatesh',
    date: '2026-09-09',
    status: 'ABSENT',
    firstDetectedAt: null,
    lastDetectedAt: null,
  },
  {
    id: 19,
    employeeId: 'EMP003',
    employeeName: 'Ananya Deshmukh',
    date: '2026-09-09',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-09T09:08:00.000Z',
    lastDetectedAt: '2026-09-09T17:02:00.000Z',
  },
  {
    id: 20,
    employeeId: 'EMP004',
    employeeName: 'Vikram Malhotra',
    date: '2026-09-09',
    status: 'PRESENT',
    firstDetectedAt: '2026-09-09T08:52:00.000Z',
    lastDetectedAt: '2026-09-09T17:40:00.000Z',
  },
];

export const DUMMY_DETECTIONS = [
  { id: 1, employeeId: 'EMP001', employeeName: 'Dr. Rajesh Sharma', timestamp: '2026-09-11T09:45:30.000Z', confidence: 0.96, detected: 1 },
  { id: 2, employeeId: 'EMP004', employeeName: 'Vikram Malhotra', timestamp: '2026-09-11T09:44:10.000Z', confidence: 0.94, detected: 1 },
  { id: 3, employeeId: 'EMP002', employeeName: 'Priya Venkatesh', timestamp: '2026-09-11T09:42:10.000Z', confidence: 0.91, detected: 1 },
  { id: 4, employeeId: 'EMP006', employeeName: 'Sneha Patil', timestamp: '2026-09-11T09:40:18.000Z', confidence: 0.89, detected: 1 },
  { id: 5, employeeId: 'EMP007', employeeName: 'Amitav Ghosh', timestamp: '2026-09-11T09:35:22.000Z', confidence: 0.93, detected: 1 },
  { id: 6, employeeId: 'EMP003', employeeName: 'Ananya Deshmukh', timestamp: '2026-09-11T09:30:00.000Z', confidence: 0.12, detected: 0 },
  { id: 7, employeeId: 'EMP005', employeeName: 'Karthik Subramanian', timestamp: '2026-09-11T09:30:00.000Z', confidence: 0.08, detected: 0 },
  { id: 8, employeeId: 'EMP008', employeeName: 'Neha Choudhury', timestamp: '2026-09-11T09:30:00.000Z', confidence: 0.15, detected: 0 },
  { id: 9, employeeId: 'EMP001', employeeName: 'Dr. Rajesh Sharma', timestamp: '2026-09-11T09:25:00.000Z', confidence: 0.95, detected: 1 },
  { id: 10, employeeId: 'EMP004', employeeName: 'Vikram Malhotra', timestamp: '2026-09-11T09:20:15.000Z', confidence: 0.92, detected: 1 },
  { id: 11, employeeId: 'EMP007', employeeName: 'Amitav Ghosh', timestamp: '2026-09-11T09:15:30.000Z', confidence: 0.90, detected: 1 },
  { id: 12, employeeId: 'EMP006', employeeName: 'Sneha Patil', timestamp: '2026-09-11T09:12:05.000Z', confidence: 0.88, detected: 1 },
  { id: 13, employeeId: 'EMP002', employeeName: 'Priya Venkatesh', timestamp: '2026-09-11T09:05:40.000Z', confidence: 0.93, detected: 1 },
  { id: 14, employeeId: 'EMP001', employeeName: 'Dr. Rajesh Sharma', timestamp: '2026-09-11T09:02:14.000Z', confidence: 0.97, detected: 1 },
  { id: 15, employeeId: 'EMP004', employeeName: 'Vikram Malhotra', timestamp: '2026-09-11T08:55:12.000Z', confidence: 0.95, detected: 1 },
  { id: 16, employeeId: 'EMP001', employeeName: 'Dr. Rajesh Sharma', timestamp: '2026-09-10T17:30:15.000Z', confidence: 0.94, detected: 1 },
  { id: 17, employeeId: 'EMP005', employeeName: 'Karthik Subramanian', timestamp: '2026-09-10T17:45:10.000Z', confidence: 0.91, detected: 1 },
  { id: 18, employeeId: 'EMP007', employeeName: 'Amitav Ghosh', timestamp: '2026-09-10T17:20:00.000Z', confidence: 0.92, detected: 1 },
  { id: 19, employeeId: 'EMP002', employeeName: 'Priya Venkatesh', timestamp: '2026-09-10T17:15:00.000Z', confidence: 0.89, detected: 1 },
  { id: 20, employeeId: 'EMP006', employeeName: 'Sneha Patil', timestamp: '2026-09-10T17:10:00.000Z', confidence: 0.93, detected: 1 },
  { id: 21, employeeId: 'EMP008', employeeName: 'Neha Choudhury', timestamp: '2026-09-10T17:05:00.000Z', confidence: 0.96, detected: 1 },
  { id: 22, employeeId: 'EMP003', employeeName: 'Ananya Deshmukh', timestamp: '2026-09-10T17:00:20.000Z', confidence: 0.90, detected: 1 },
  { id: 23, employeeId: 'EMP004', employeeName: 'Vikram Malhotra', timestamp: '2026-09-10T09:30:00.000Z', confidence: 0.10, detected: 0 },
  { id: 24, employeeId: 'EMP005', employeeName: 'Karthik Subramanian', timestamp: '2026-09-10T09:20:00.000Z', confidence: 0.87, detected: 1 },
  { id: 25, employeeId: 'EMP003', employeeName: 'Ananya Deshmukh', timestamp: '2026-09-10T09:10:00.000Z', confidence: 0.94, detected: 1 },
];

export const DUMMY_NOTIFICATIONS = [
  {
    id: 1,
    employeeId: 'EMP003',
    employeeName: 'Ananya Deshmukh',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-11T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'COMPLETED',
  },
  {
    id: 2,
    employeeId: 'EMP005',
    employeeName: 'Karthik Subramanian',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-11T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'PENDING',
  },
  {
    id: 3,
    employeeId: 'EMP008',
    employeeName: 'Neha Choudhury',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-11T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'FAILED',
  },
  {
    id: 4,
    employeeId: 'EMP004',
    employeeName: 'Vikram Malhotra',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-10T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'COMPLETED',
  },
  {
    id: 5,
    employeeId: 'EMP002',
    employeeName: 'Priya Venkatesh',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-09T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'COMPLETED',
  },
  {
    id: 6,
    employeeId: 'EMP006',
    employeeName: 'Sneha Patil',
    eventType: 'EMPLOYEE_ABSENCE',
    timestamp: '2026-09-09T09:30:00.000Z',
    whatsappStatus: 'DELIVERED',
    emailStatus: 'DELIVERED',
    callStatus: 'COMPLETED',
  },
];

export default function History() {
  const [attendance, setAttendance] = useState(DUMMY_ATTENDANCE);
  const [detections, setDetections] = useState(DUMMY_DETECTIONS);
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const [employees, setEmployees] = useState(DUMMY_EMPLOYEES);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Filter States
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination for Detections
  const [detectionPage, setDetectionPage] = useState(1);

  const fetchAllData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);

    try {
      const [attRes, detRes, notifRes, empRes] = await Promise.all([
        axios.get(`${API_URL}/attendance`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/detections`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/notifications`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/employees`).catch(() => ({ data: [] })),
      ]);

      setAttendance(attRes.data && attRes.data.length > 0 ? attRes.data : DUMMY_ATTENDANCE);
      setDetections(detRes.data && detRes.data.length > 0 ? detRes.data : DUMMY_DETECTIONS);
      setNotifications(notifRes.data && notifRes.data.length > 0 ? notifRes.data : DUMMY_NOTIFICATIONS);
      setEmployees(empRes.data && empRes.data.length > 0 ? empRes.data : DUMMY_EMPLOYEES);
    } catch (err) {
      console.error('Failed to fetch history datasets:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleResetFilters = () => {
    setSelectedEmployee('');
    setStartDate('');
    setEndDate('');
    setSelectedStatus('');
    setDetectionPage(1);
    setPdfError('');
  };

  // Filtered Attendance Log
  const filteredAttendance = useMemo(() => {
    return attendance.filter((item) => {
      // Employee filter
      if (selectedEmployee && item.employeeId !== selectedEmployee) {
        return false;
      }
      // Status filter
      if (selectedStatus && item.status?.toUpperCase() !== selectedStatus.toUpperCase()) {
        return false;
      }
      // Date filter (item.date is expected as YYYY-MM-DD)
      const recordDate = item.date ? item.date.split('T')[0] : '';
      if (startDate && recordDate && recordDate < startDate) {
        return false;
      }
      if (endDate && recordDate && recordDate > endDate) {
        return false;
      }
      return true;
    });
  }, [attendance, selectedEmployee, selectedStatus, startDate, endDate]);

  // Filtered Detection Log
  const filteredDetections = useMemo(() => {
    return detections.filter((item) => {
      // Employee filter
      if (selectedEmployee && item.employeeId !== selectedEmployee) {
        return false;
      }
      // Status filter: PRESENT => detected = 1, ABSENT => detected = 0
      if (selectedStatus === 'PRESENT' && !item.detected) {
        return false;
      }
      if (selectedStatus === 'ABSENT' && item.detected) {
        return false;
      }
      // Date filter
      const recordDate = item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : '';
      if (startDate && recordDate && recordDate < startDate) {
        return false;
      }
      if (endDate && recordDate && recordDate > endDate) {
        return false;
      }
      return true;
    });
  }, [detections, selectedEmployee, selectedStatus, startDate, endDate]);

  // Filtered Notifications Log
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Employee filter
      if (selectedEmployee && item.employeeId !== selectedEmployee) {
        return false;
      }
      // Date filter
      const recordDate = item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : '';
      if (startDate && recordDate && recordDate < startDate) {
        return false;
      }
      if (endDate && recordDate && recordDate > endDate) {
        return false;
      }
      return true;
    });
  }, [notifications, selectedEmployee, startDate, endDate]);

  // Pagination Calculation for Detections
  const totalDetectionPages = Math.ceil(filteredDetections.length / DETECTIONS_PER_PAGE) || 1;
  const paginatedDetections = useMemo(() => {
    const startIndex = (detectionPage - 1) * DETECTIONS_PER_PAGE;
    return filteredDetections.slice(startIndex, startIndex + DETECTIONS_PER_PAGE);
  }, [filteredDetections, detectionPage]);

  // Reset detection page when filters change
  useEffect(() => {
    setDetectionPage(1);
  }, [selectedEmployee, selectedStatus, startDate, endDate]);

  // Client-side PDF Export of filtered Attendance records
  const handleExportPDF = async () => {
    setPdfError('');

    if (filteredAttendance.length === 0) {
      setPdfError('No attendance records to export with current filters.');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      // Yield to event loop to allow UI to render "Generating..." state
      await new Promise((resolve) => setTimeout(resolve, 60));

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      // 1. Header: "VISIDICT — Attendance Report", color #1F2937, ~16pt
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55); // #1F2937
      doc.text('VISIDICT — Attendance Report', 40, 42);

      // 2. Subheader: "Generated: <current date/time>", ~10pt, gray
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58);

      // Table columns and data
      const tableColumns = ['Date', 'Employee', 'Status', 'First Seen', 'Last Seen'];
      const tableRows = filteredAttendance.map((rec) => [
        rec.date || '—',
        rec.employeeName ? `${rec.employeeName} (${rec.employeeId})` : (rec.employeeId || '—'),
        rec.status || '—',
        rec.firstDetectedAt ? new Date(rec.firstDetectedAt).toLocaleTimeString() : '—',
        rec.lastDetectedAt ? new Date(rec.lastDetectedAt).toLocaleTimeString() : '—',
      ]);

      // Render Table using autoTable
      autoTable(doc, {
        startY: 72,
        head: [tableColumns],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [79, 70, 229], // RGB [79, 70, 229] matching Primary #4F46E5
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
        },
        bodyStyles: {
          textColor: [31, 41, 55],
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [243, 244, 246], // matches Background #F3F4F6
        },
        styles: {
          cellPadding: 6,
          overflow: 'linebreak',
        },
        margin: { left: 40, right: 40, bottom: 40 },
      });

      // Save PDF with filename: visidict-attendance-report-<YYYY-MM-DD>.pdf
      const todayStr = new Date().toISOString().split('T')[0];
      doc.save(`visidict-attendance-report-${todayStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      setPdfError('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const hasActiveFilters = Boolean(selectedEmployee || startDate || endDate || selectedStatus);

  return (
    <div className="history-page">
      {/* Page Header */}
      <div className="history-header">
        <div className="history-title-group">
          <h2>
            <HistoryIcon size={28} color="var(--navy)" />
            <span>Historical Records & Audit Logs</span>
          </h2>
          <p>Comprehensive attendance records, camera detection events, and n8n automations</p>
        </div>

        <div className="history-header-actions">
          {pdfError && (
            <div className="pdf-error-badge" role="alert">
              <AlertCircle size={14} />
              <span>{pdfError}</span>
            </div>
          )}

          <button
            type="button"
            className="action-btn action-btn-secondary"
            onClick={() => fetchAllData(true)}
            disabled={isRefreshing || isLoading || isGeneratingPdf}
            title="Refresh historical data"
          >
            <RotateCw size={16} className={isRefreshing ? 'rotate-icon' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={handleExportPDF}
            disabled={isGeneratingPdf || isLoading}
            title="Export filtered attendance data to PDF"
          >
            <FileDown size={16} />
            <span>{isGeneratingPdf ? 'Generating...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar Panel */}
      <div className="glass-panel filter-panel">
        <div className="filter-grid">
          {/* Employee Dropdown */}
          <div className="filter-item">
            <label className="filter-label" htmlFor="filter-employee">
              Employee
            </label>
            <select
              id="filter-employee"
              className="filter-select"
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setPdfError('');
              }}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="filter-item">
            <label className="filter-label" htmlFor="filter-start-date">
              From Date
            </label>
            <input
              id="filter-start-date"
              type="date"
              className="filter-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPdfError('');
              }}
            />
          </div>

          {/* End Date */}
          <div className="filter-item">
            <label className="filter-label" htmlFor="filter-end-date">
              To Date
            </label>
            <input
              id="filter-end-date"
              type="date"
              className="filter-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPdfError('');
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div className="filter-item">
            <label className="filter-label" htmlFor="filter-status">
              Attendance Status
            </label>
            <select
              id="filter-status"
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPdfError('');
              }}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          {/* Reset Action */}
          {hasActiveFilters && (
            <div className="filter-item">
              <button
                type="button"
                className="filter-reset-btn"
                onClick={handleResetFilters}
                title="Clear all filters"
              >
                <XCircle size={16} />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. Attendance Log */}
      <div className="glass-panel">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <FileSpreadsheet size={22} color="var(--navy)" />
            <h3>Attendance Log</h3>
            <span className="count-chip">{filteredAttendance.length} records</span>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Status</th>
                <th>First Detected</th>
                <th>Last Detected</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((item) => (
                <tr key={`${item.id || item.employeeId}-${item.date}`}>
                  <td style={{ fontWeight: 600 }}>{item.date}</td>
                  <td>
                    <code style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{item.employeeId}</code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.employeeName}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {item.firstDetectedAt ? new Date(item.firstDetectedAt).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {item.lastDetectedAt ? new Date(item.lastDetectedAt).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}

              {filteredAttendance.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="empty-table-row">
                    <div className="empty-state-box">
                      <FileSpreadsheet size={32} opacity={0.4} />
                      <p>No attendance records match the specified filters.</p>
                      <span>Try adjusting or clearing your active date or employee filters.</span>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan="6" className="empty-table-row">
                    <div className="empty-state-box">
                      <RotateCw size={24} className="rotate-icon" />
                      <p>Loading attendance data...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Detection Log (Paginated Client-Side) */}
      <div className="glass-panel">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <Camera size={22} color="var(--navy)" />
            <h3>Detection Log</h3>
            <span className="count-chip">{filteredDetections.length} total events</span>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Confidence</th>
                <th>Detection Result</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDetections.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{item.employeeId}</code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.employeeName}</td>
                  <td>
                    {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : '--'}
                  </td>
                  <td>
                    <span className={`badge ${item.detected ? 'present' : 'absent'}`}>
                      <CheckCircle2 size={12} />
                      {item.detected ? 'Detected' : 'Missed'}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredDetections.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="5" className="empty-table-row">
                    <div className="empty-state-box">
                      <Camera size={32} opacity={0.4} />
                      <p>No detection records found.</p>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan="5" className="empty-table-row">
                    <div className="empty-state-box">
                      <RotateCw size={24} className="rotate-icon" />
                      <p>Loading detection history...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredDetections.length > DETECTIONS_PER_PAGE && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing {(detectionPage - 1) * DETECTIONS_PER_PAGE + 1} to{' '}
              {Math.min(detectionPage * DETECTIONS_PER_PAGE, filteredDetections.length)} of{' '}
              {filteredDetections.length} detections
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                onClick={() => setDetectionPage((p) => Math.max(1, p - 1))}
                disabled={detectionPage === 1}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <span className="page-current-indicator">
                Page {detectionPage} of {totalDetectionPages}
              </span>

              <button
                type="button"
                className="page-btn"
                onClick={() => setDetectionPage((p) => Math.min(totalDetectionPages, p + 1))}
                disabled={detectionPage === totalDetectionPages}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Notification & Automations Log */}
      <div className="glass-panel">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <Bell size={22} color="var(--navy)" />
            <h3>Notification & Alert Log</h3>
            <span className="count-chip">{filteredNotifications.length} alerts</span>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Employee</th>
                <th>Event Type</th>
                <th>WhatsApp Status</th>
                <th>Email Status</th>
                <th>Call Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.employeeName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      ID: {item.employeeId}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy)' }}>
                      {item.eventType || 'EMPLOYEE_ABSENCE'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={item.whatsappStatus} />
                  </td>
                  <td>
                    <StatusBadge status={item.emailStatus} />
                  </td>
                  <td>
                    <StatusBadge status={item.callStatus} />
                  </td>
                </tr>
              ))}

              {filteredNotifications.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="empty-table-row">
                    <div className="empty-state-box">
                      <Bell size={32} opacity={0.4} />
                      <p>No alert logs found.</p>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan="6" className="empty-table-row">
                    <div className="empty-state-box">
                      <RotateCw size={24} className="rotate-icon" />
                      <p>Loading notification logs...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
