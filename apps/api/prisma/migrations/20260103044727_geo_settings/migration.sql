-- CreateTable
CREATE TABLE "CompanySettings" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geoRequired" BOOLEAN NOT NULL DEFAULT true,
    "geofenceLat" REAL NOT NULL,
    "geofenceLng" REAL NOT NULL,
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "maxAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeClockEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "accuracy" REAL,
    "geoCapturedAt" DATETIME,
    "geoDistanceMeters" INTEGER,
    "geoStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "blockedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeClockEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeClockEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeClockEvent" ("companyId", "createdAt", "deviceId", "employeeId", "id", "ip", "source", "timestamp", "type", "userAgent") SELECT "companyId", "createdAt", "deviceId", "employeeId", "id", "ip", "source", "timestamp", "type", "userAgent" FROM "TimeClockEvent";
DROP TABLE "TimeClockEvent";
ALTER TABLE "new_TimeClockEvent" RENAME TO "TimeClockEvent";
CREATE INDEX "TimeClockEvent_companyId_employeeId_timestamp_idx" ON "TimeClockEvent"("companyId", "employeeId", "timestamp");
CREATE INDEX "TimeClockEvent_employeeId_timestamp_idx" ON "TimeClockEvent"("employeeId", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
