import { createHmac, timingSafeEqual } from "crypto";

type QrPayload = {
  companyId: string;
  date: string;
  sig: string;
};

type EmployeeQrPayload = {
  companyId: string;
  employeeId: string;
  sig: string;
};

const encodeBase64Url = (value: string) => Buffer.from(value, "utf-8").toString("base64url");
const decodeBase64Url = (value: string) => Buffer.from(value, "base64url").toString("utf-8");

export const buildQrPayload = (companyId: string, date: string, secret: string) => {
  const data = `${companyId}|${date}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  const payload: QrPayload = { companyId, date, sig };
  return encodeBase64Url(JSON.stringify(payload));
};

export const parseAndVerifyQrToken = (token: string, secret: string) => {
  let parsed: QrPayload;
  try {
    parsed = JSON.parse(decodeBase64Url(token)) as QrPayload;
  } catch {
    throw new Error("INVALID_QR");
  }

  if (!parsed?.companyId || !parsed?.date || !parsed?.sig) {
    throw new Error("INVALID_QR");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    throw new Error("INVALID_QR");
  }

  const data = `${parsed.companyId}|${parsed.date}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.sig);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("INVALID_QR");
  }

  return {
    companyId: parsed.companyId,
    date: parsed.date,
  };
};

export const buildEmployeeQrToken = (companyId: string, employeeId: string, secret: string) => {
  const data = `${companyId}|${employeeId}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  const payload: EmployeeQrPayload = { companyId, employeeId, sig };
  return encodeBase64Url(JSON.stringify(payload));
};

export const parseAndVerifyEmployeeQrToken = (token: string, secret: string) => {
  let parsed: EmployeeQrPayload;
  try {
    parsed = JSON.parse(decodeBase64Url(token)) as EmployeeQrPayload;
  } catch {
    throw new Error("INVALID_EMPLOYEE_QR");
  }

  if (!parsed?.companyId || !parsed?.employeeId || !parsed?.sig) {
    throw new Error("INVALID_EMPLOYEE_QR");
  }

  const data = `${parsed.companyId}|${parsed.employeeId}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.sig);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("INVALID_EMPLOYEE_QR");
  }

  return {
    companyId: parsed.companyId,
    employeeId: parsed.employeeId,
  };
};
