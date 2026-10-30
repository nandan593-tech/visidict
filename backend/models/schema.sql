-- Schema definition for VISIDICT2 PostgreSQL Database

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    "expectedPresence" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detections (
    id SERIAL PRIMARY KEY,
    "employeeId" TEXT REFERENCES employees(id),
    detected BOOLEAN,
    confidence REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    "employeeId" TEXT REFERENCES employees(id),
    date DATE,
    status TEXT,
    "firstDetectedAt" TIMESTAMP,
    "lastDetectedAt" TIMESTAMP,
    "absentAt" TIMESTAMP,
    CONSTRAINT unique_employee_date UNIQUE ("employeeId", date)
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    "employeeId" TEXT REFERENCES employees(id),
    "eventType" TEXT,
    "whatsappStatus" TEXT,
    "emailStatus" TEXT,
    "callStatus" TEXT,
    "n8nResponse" TEXT,
    "absentAt" TIMESTAMP,
    "whatsappSentAt" TIMESTAMP,
    "emailSentAt" TIMESTAMP,
    "callSentAt" TIMESTAMP,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial employee if not exists
INSERT INTO employees (id, name, department) 
VALUES ('EMP001', 'John Doe', 'Engineering')
ON CONFLICT (id) DO NOTHING;
