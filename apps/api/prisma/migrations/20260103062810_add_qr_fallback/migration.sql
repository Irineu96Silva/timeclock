-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geoRequired" BOOLEAN NOT NULL DEFAULT true,
    "geofenceLat" REAL NOT NULL,
    "geofenceLng" REAL NOT NULL,
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "maxAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
    "qrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "punchFallbackMode" TEXT NOT NULL DEFAULT 'GEO_OR_QR',
    "qrSecret" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CompanySettings" ("companyId", "geoRequired", "geofenceEnabled", "geofenceLat", "geofenceLng", "geofenceRadiusMeters", "maxAccuracyMeters") SELECT "companyId", "geoRequired", "geofenceEnabled", "geofenceLat", "geofenceLng", "geofenceRadiusMeters", "maxAccuracyMeters" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
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
    "punchMethod" TEXT NOT NULL DEFAULT 'GEO',
    "qrDate" TEXT,
    "qrNonce" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeClockEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeClockEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeClockEvent" ("accuracy", "blockedReason", "companyId", "createdAt", "deviceId", "employeeId", "geoCapturedAt", "geoDistanceMeters", "geoStatus", "id", "ip", "latitude", "longitude", "source", "timestamp", "type", "userAgent") SELECT "accuracy", "blockedReason", "companyId", "createdAt", "deviceId", "employeeId", "geoCapturedAt", "geoDistanceMeters", "geoStatus", "id", "ip", "latitude", "longitude", "source", "timestamp", "type", "userAgent" FROM "TimeClockEvent";
DROP TABLE "TimeClockEvent";
ALTER TABLE "new_TimeClockEvent" RENAME TO "TimeClockEvent";
CREATE INDEX "TimeClockEvent_companyId_employeeId_timestamp_idx" ON "TimeClockEvent"("companyId", "employeeId", "timestamp");
CREATE INDEX "TimeClockEvent_employeeId_timestamp_idx" ON "TimeClockEvent"("employeeId", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
