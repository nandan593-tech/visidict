import React from 'react';
import { Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function StatusBadge({ status }) {
  const normalized = (status || '').toUpperCase();

  if (normalized === 'PENDING') {
    return (
      <span className="badge pending">
        <Clock size={12} /> Pending
      </span>
    );
  }

  if (normalized === 'SENT' || normalized === 'SUCCESS') {
    return (
      <span className="badge present">
        <CheckCircle2 size={12} /> Sent
      </span>
    );
  }

  if (normalized === 'PRESENT') {
    return (
      <span className="badge present">
        <CheckCircle2 size={12} /> Present
      </span>
    );
  }

  if (normalized === 'ABSENT') {
    return (
      <span className="badge absent">
        <ShieldAlert size={12} /> Absent
      </span>
    );
  }

  return (
    <span className="badge failed">
      <ShieldAlert size={12} /> {status || 'N/A'}
    </span>
  );
}
