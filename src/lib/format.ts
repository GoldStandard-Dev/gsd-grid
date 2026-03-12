export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function onlyDigits(value: string) {
  return (value ?? "").replace(/\D/g, "");
}

export function cleanDecimalInput(value: string) {
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function formatPhoneInput(value: string) {
  const digits = onlyDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatPercentDisplay(value: string) {
  const normalized = cleanDecimalInput(value);

  if (!normalized) return "";
  if (normalized.startsWith(".")) return `0${normalized}`;

  const [wholeRaw, decimalRaw = ""] = normalized.split(".");
  const whole = wholeRaw.slice(0, 3);
  const decimal = decimalRaw.slice(0, 2);

  return decimal.length ? `${whole}.${decimal}` : whole;
}

export function formatCurrencyDisplay(value: string) {
  const normalized = cleanDecimalInput(value);

  if (!normalized) return "";
  if (normalized.startsWith(".")) return `0${normalized}`;

  const [wholeRaw, decimalRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const decimal = decimalRaw.slice(0, 2);

  return decimal.length ? `${whole}.${decimal}` : whole;
}

export function onlyAlphaNumericUpper(value: string) {
  return (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function normalizeHexColor(value: string) {
  let next = (value ?? "").toUpperCase().replace(/[^#A-F0-9]/g, "");
  if (!next) return "#";
  if (!next.startsWith("#")) next = `#${next.replace(/#/g, "")}`;
  next = `#${next.replace(/#/g, "")}`;
  return next.slice(0, 7);
}

export function formatWebsiteInput(value: string, finalize = false) {
  let next = (value ?? "").trim().toLowerCase();

  next = next.replace(/\s+/g, "");
  next = next.replace(/^https?:\/\//, "");
  next = next.replace(/^www\./, "www.");

  if (!finalize) return next;

  if (!next) return "";
  return next.startsWith("http://") || next.startsWith("https://")
    ? next
    : `https://${next}`;
}

/* -----------------------------
   WORK ORDER NUMBER FORMAT
----------------------------- */

export function formatWorkOrderNumber(num: number | null | undefined) {
  if (!num) return "—";
  return `WO-${String(num).padStart(4, "0")}`;
}

/* -----------------------------
   INVOICE NUMBER FORMAT
----------------------------- */

export function formatInvoiceNumber(num: number | null | undefined) {
  if (!num) return "—";
  return `INV-${String(num).padStart(4, "0")}`;
}