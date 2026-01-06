PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations VALUES('518fe4a5-e815-4e51-88d6-0996c7a99db0','b785031d003ce1c066faca1b6e1471f317b97157a32482996955230efddd7c8a',1767386267406,'20260102203747_folha_de_ponto',NULL,NULL,1767386267337,1);
INSERT INTO _prisma_migrations VALUES('7680e27e-511e-4e21-907e-72e2988847ab','8bf3b47115e3d80453c1e38e84ff921bb0131c57001f57156d8b94626b171fb6',1767415647446,'20260103044727_geo_settings',NULL,NULL,1767415647410,1);
INSERT INTO _prisma_migrations VALUES('a9f1f406-7906-4932-b7c5-a2364f824e76','3dfb5629ce2f62ffc7ca6ff09a01650b2cc0cb1879d9f5045ee2083bc33b9e50',1767421690707,'20260103062810_add_qr_fallback',NULL,NULL,1767421690657,1);
INSERT INTO _prisma_migrations VALUES('4f419b06-2882-40ee-b02a-421713a36dee','06f4ab67d51079784f9ce84d94b8e62a53be13677b48960c7db871e2736ce128',1767430748661,'20260103085908_add_kiosk_pin',NULL,NULL,1767430748625,1);
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO Company VALUES('cmjxc948k000014i8wrm9pdzi','Empresa Demo',1767386439092);
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO User VALUES('cmjxc94cg000214i8cj6u93ww','cmjxc948k000014i8wrm9pdzi','admin@demo.com','$2b$10$bLJ/anbF4gA12osxch2EJuwdUIR2WmUVucGLVd1XAXVBeLxEII2KO','ADMIN',1,NULL,1767386439232,1767448238379);
INSERT INTO User VALUES('cmjxpywvi0002ou2xve04dia9','cmjxc948k000014i8wrm9pdzi','maria@demo.com','$2b$10$QRLi7r/Aqk.Vbp/Yo0CQFOOfVzUb/YhZCYNO16yJP91Q049wxhAdW','EMPLOYEE',1,NULL,1767409477613,1767430737362);
INSERT INTO User VALUES('cmjxukhg000074k4c683g1m9f','cmjxc948k000014i8wrm9pdzi','rafaela@domc.com','$2b$10$s/edftu2V9zfiWm329bLleVlCP1Hm9f7RPvAAzdeDM.EBAYvvr2ku','EMPLOYEE',1,'$2b$10$rhaYn5iIOPzvsQ2TIUNzuObdea76ymoypz/nYHW0US5K7cl1shwBO',1767417202513,1767448243088);
CREATE TABLE IF NOT EXISTS "TimeAdjustmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "originalEventId" TEXT,
    "requestedType" TEXT NOT NULL,
    "requestedTimestamp" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeAdjustmentRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeAdjustmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeAdjustmentRequest_originalEventId_fkey" FOREIGN KEY ("originalEventId") REFERENCES "TimeClockEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeAdjustmentRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO AuditLog VALUES('cmjxpywvs0006ou2xc4jok2a1','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_CREATED','EmployeeProfile','cmjxpywvp0004ou2x4r6fxda1',NULL,NULL,NULL,1767409477625);
INSERT INTO AuditLog VALUES('cmjxr4dap00029c9z0vxa5x2f','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_PASSWORD_RESET','EmployeeProfile','cmjxpywvp0004ou2x4r6fxda1',NULL,NULL,NULL,1767411411791);
INSERT INTO AuditLog VALUES('cmjxr5jzq00079c9zudeq9vtb','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','TIMECLOCK_PUNCH','TimeClockEvent','cmjxr5jzn00059c9zkfygopvb',NULL,NULL,NULL,1767411467127);
INSERT INTO AuditLog VALUES('cmjxr7bs2000a9c9zmepwgwlg','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_PASSWORD_RESET','EmployeeProfile','cmjxpywvp0004ou2x4r6fxda1',NULL,NULL,NULL,1767411549794);
INSERT INTO AuditLog VALUES('cmjxr8v3j000f9c9zs2wwsxr5','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','TIMECLOCK_PUNCH','TimeClockEvent','cmjxr8v3g000d9c9zonrdw3hz',NULL,NULL,NULL,1767411621488);
INSERT INTO AuditLog VALUES('cmjxr8wwr000k9c9zk3lq459e','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','TIMECLOCK_PUNCH','TimeClockEvent','cmjxr8wwm000i9c9z0hlycf3p',NULL,NULL,NULL,1767411623835);
INSERT INTO AuditLog VALUES('cmjxr8yn4000p9c9zsrtbuqbv','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','TIMECLOCK_PUNCH','TimeClockEvent','cmjxr8ymw000n9c9zclfubf1u',NULL,NULL,NULL,1767411626081);
INSERT INTO AuditLog VALUES('cmjxufgmx00024k4cb35qzua5','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_PASSWORD_RESET','EmployeeProfile','cmjxpywvp0004ou2x4r6fxda1',NULL,NULL,NULL,1767416968185);
INSERT INTO AuditLog VALUES('cmjxuh84p00044k4cu7f4gggv','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT; Windows NT 10.0; pt-BR) WindowsPowerShell/5.1.26100.7462','{"reason":"OUTSIDE_GEOFENCE","geoStatus":"OUTSIDE","distanceMeters":5637686,"radiusMeters":200,"accuracy":10}',1767417050473);
INSERT INTO AuditLog VALUES('cmjxukhg6000b4k4cm58pqe3m','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_CREATED','EmployeeProfile','cmjxukhg400094k4cp366i4fk',NULL,NULL,NULL,1767417202518);
INSERT INTO AuditLog VALUES('cmjxulkqn000d4k4cnzllcpgx','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"LOW_ACCURACY","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":102}',1767417253439);
INSERT INTO AuditLog VALUES('cmjxulnwk000f4k4crzkpzy2e','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"LOW_ACCURACY","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":102}',1767417257541);
INSERT INTO AuditLog VALUES('cmjxuloum000h4k4cl1w0i373','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"LOW_ACCURACY","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":102}',1767417258766);
INSERT INTO AuditLog VALUES('cmjxunc86000j4k4crz0jl48z','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"LOW_ACCURACY","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":102}',1767417335718);
INSERT INTO AuditLog VALUES('cmjy2kbbq0002mvya8dmk2u8t','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_PASSWORD_RESET','EmployeeProfile','cmjxukhg400094k4cp366i4fk',NULL,NULL,NULL,1767430631509);
INSERT INTO AuditLog VALUES('cmjy2kuzy0004mvya7dx7v22m','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"LOW_ACCURACY","methodAttempted":"GEO","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":102,"qrDate":null}',1767430657006);
INSERT INTO AuditLog VALUES('cmjy2lufj0007mvyac8l2965s','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_PASSWORD_RESET','EmployeeProfile','cmjxpywvp0004ou2x4r6fxda1',NULL,NULL,NULL,1767430702927);
INSERT INTO AuditLog VALUES('cmjy2rxns0001vz766x1z9xsu','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_QR_REGENERATED','EmployeeProfile','cmjxukhg400094k4cp366i4fk',NULL,NULL,NULL,1767430987049);
INSERT INTO AuditLog VALUES('cmjy2sc2q0003vz761rxjfy4t','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','EMPLOYEE_QR_REGENERATED','EmployeeProfile','cmjxukhg400094k4cp366i4fk',NULL,NULL,NULL,1767431005731);
INSERT INTO AuditLog VALUES('cmjyd1wq80001y1h2z7q5yiby','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"GEO_FAILED_QR_REQUIRED","methodAttempted":"GEO","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":275,"qrDate":null}',1767448248557);
INSERT INTO AuditLog VALUES('cmjyd1yo40003y1h219ech38u','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"GEO_FAILED_QR_REQUIRED","methodAttempted":"GEO","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":275,"qrDate":null}',1767448251076);
INSERT INTO AuditLog VALUES('cmjyd21kr0005y1h28tzhobj3','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','TIMECLOCK_PUNCH_BLOCKED','TimeClockEvent',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','{"reason":"GEO_FAILED_QR_REQUIRED","methodAttempted":"GEO","geoStatus":"LOW_ACCURACY","distanceMeters":null,"radiusMeters":null,"accuracy":186,"qrDate":null}',1767448254844);
CREATE TABLE IF NOT EXISTS "TimeClockEvent" (
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
INSERT INTO TimeClockEvent VALUES('cmjxr5jzn00059c9zkfygopvb','cmjxc948k000014i8wrm9pdzi','cmjxpywvp0004ou2x4r6fxda1','IN',1767411467120,'PWA','::1','Mozilla/5.0 (Windows NT; Windows NT 10.0; pt-BR) WindowsPowerShell/5.1.26100.7462',NULL,NULL,NULL,NULL,NULL,NULL,'MISSING',NULL,'GEO',NULL,NULL,1767411467124);
INSERT INTO TimeClockEvent VALUES('cmjxr8v3g000d9c9zonrdw3hz','cmjxc948k000014i8wrm9pdzi','cmjxpywvp0004ou2x4r6fxda1','BREAK_START',1767411621481,'PWA','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',NULL,NULL,NULL,NULL,NULL,NULL,'MISSING',NULL,'GEO',NULL,NULL,1767411621485);
INSERT INTO TimeClockEvent VALUES('cmjxr8wwm000i9c9z0hlycf3p','cmjxc948k000014i8wrm9pdzi','cmjxpywvp0004ou2x4r6fxda1','BREAK_END',1767411623826,'PWA','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',NULL,NULL,NULL,NULL,NULL,NULL,'MISSING',NULL,'GEO',NULL,NULL,1767411623830);
INSERT INTO TimeClockEvent VALUES('cmjxr8ymw000n9c9zclfubf1u','cmjxc948k000014i8wrm9pdzi','cmjxpywvp0004ou2x4r6fxda1','OUT',1767411626068,'PWA','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',NULL,NULL,NULL,NULL,NULL,NULL,'MISSING',NULL,'GEO',NULL,NULL,1767411626072);
CREATE TABLE IF NOT EXISTS "EmployeeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "document" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pinHash" TEXT,
    "pinUpdatedAt" DATETIME,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "breakEndTime" TEXT, "breakStartTime" TEXT, "timezone" TEXT DEFAULT 'America/Sao_Paulo', "toleranceMinutes" INTEGER DEFAULT 5, "workEndTime" TEXT, "workStartTime" TEXT,
    CONSTRAINT "EmployeeProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO EmployeeProfile VALUES('cmjxc94ct000414i819you8fv','cmjxc948k000014i8wrm9pdzi','cmjxc94cg000214i8cj6u93ww','Admin Demo',NULL,1,NULL,NULL,0,NULL,1767386439245,1767386439245,NULL,NULL,'America/Sao_Paulo',5,NULL,NULL);
INSERT INTO EmployeeProfile VALUES('cmjxpywvp0004ou2x4r6fxda1','cmjxc948k000014i8wrm9pdzi','cmjxpywvi0002ou2xve04dia9','Maria Silva','123456789',1,NULL,NULL,0,NULL,1767409477622,1767409477622,NULL,NULL,'America/Sao_Paulo',5,NULL,NULL);
INSERT INTO EmployeeProfile VALUES('cmjxukhg400094k4cp366i4fk','cmjxc948k000014i8wrm9pdzi','cmjxukhg000074k4c683g1m9f','Rafaela Domiciano dos Santos','45401269897',1,NULL,NULL,0,NULL,1767417202517,1767417202517,NULL,NULL,'America/Sao_Paulo',5,NULL,NULL);
CREATE TABLE IF NOT EXISTS "CompanySettings" (
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
    "kioskDeviceLabel" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO CompanySettings VALUES('cmjxc948k000014i8wrm9pdzi',1,1,-23.50751847469069844,-46.31521954232913885,200,100,1,'GEO_OR_QR','952ca3f3b50a73f87886ddb89645f40fe4293ea275ea9383d1e510c780eacf11','');
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
CREATE INDEX "TimeAdjustmentRequest_companyId_employeeId_idx" ON "TimeAdjustmentRequest"("companyId", "employeeId");
CREATE INDEX "TimeAdjustmentRequest_status_idx" ON "TimeAdjustmentRequest"("status");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "TimeClockEvent_companyId_employeeId_timestamp_idx" ON "TimeClockEvent"("companyId", "employeeId", "timestamp");
CREATE INDEX "TimeClockEvent_employeeId_timestamp_idx" ON "TimeClockEvent"("employeeId", "timestamp");
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");
CREATE INDEX "EmployeeProfile_companyId_idx" ON "EmployeeProfile"("companyId");
COMMIT;
