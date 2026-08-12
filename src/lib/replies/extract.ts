/**
 * Reply extraction — pure, I/O-free helpers that turn a Gmail thread into
 * candidate reply messages. Everything here is unit-testable and has no
 * dependency on Prisma or the network; the DB orchestration lives in
 * `src/lib/replies/sync.ts`.
 */

export interface GmailPayloadLike {
  mimeType?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }> | null;
  body?: { data?: string | null; size?: number | null } | null;
  parts?: GmailPayloadLike[] | null;
}

export interface GmailMessageLike {
  id?: string | null;
  threadId?: string | null;
  internalDate?: string | null;
  labelIds?: string[] | null;
  payload?: GmailPayloadLike | null;
}

export interface ThreadLike {
  id?: string | null;
  messages?: GmailMessageLike[] | null;
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  /** Milliseconds since epoch, or null when the message carries none. */
  internalDate: number | null;
  /** Raw From header value (may include display name). */
  from: string;
  /** Lower-cased email address parsed out of From. */
  fromEmail: string;
  to: string;
  subject: string;
  /** Decoded plain-text body (HTML fallback stripped of tags). */
  body: string;
  /** Lower-cased header name → raw value. */
  headers: Record<string, string>;
}

export interface ReplyCandidate {
  parsed: ParsedGmailMessage;
  isAutoReply: boolean;
  isBounce: boolean;
  isUnsubscribe: boolean;
}

export interface ExtractOptions {
  /** Our sending mailbox address — messages from it are our own and skipped. */
  sentFromEmail: string;
  /** Recipient email(s) of the messages we sent in this thread (the lead). */
  leadEmails: string[];
}

/** Normalize an email address for comparison: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Pull the address out of "Name <a@b.c>" / "a@b.c" / bare display text. */
export function extractEmailAddress(from: string): string {
  const trimmed = from.trim();
  const angle = /<([^<>]+)>/.exec(trimmed);
  return normalizeEmail(angle ? angle[1] : trimmed);
}

/** Decode an RFC 2047 encoded-word header (B and Q forms). */
export function decodeRfc2047(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (_whole, _charset: string, enc: string, payload: string) => {
      try {
        if (enc.toLowerCase() === "b") {
          return Buffer.from(payload, "base64").toString("utf8");
        }
        // Q-encoding: underscores are spaces, %XX is a byte.
        return payload
          .replace(/_/g, " ")
          .replace(/%([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
      } catch {
        return value;
      }
    },
  );
}

/** Base64url-decode a Gmail body part into UTF-8 text. */
function decodeBodyData(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Strip HTML to something readable (used as a body fallback). */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Collect plain/text + html text from a Gmail payload tree. */
function walkPayload(
  payload: GmailPayloadLike | null | undefined,
  out: { plain: string[]; html: string[] },
): void {
  if (!payload) return;
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    out.plain.push(decodeBodyData(payload.body.data));
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    out.html.push(stripHtml(decodeBodyData(payload.body.data)));
  }
  for (const part of payload.parts ?? []) walkPayload(part, out);
}

/** Best-effort plain-text body of a message payload. */
export function extractBodyText(
  payload: GmailPayloadLike | null | undefined,
): string {
  const out = { plain: [] as string[], html: [] as string[] };
  walkPayload(payload, out);
  return (out.plain.join("\n") || out.html.join("\n")).trim();
}

export function headersToRecord(
  headers: GmailPayloadLike["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) {
    const name = (h.name ?? "").toLowerCase();
    if (name && h.value != null) out[name] = h.value;
  }
  return out;
}

/** Parse a raw Gmail message into a flat, usable shape. */
export function parseGmailMessage(
  msg: GmailMessageLike | null | undefined,
): ParsedGmailMessage | null {
  if (!msg?.id) return null;
  const headers = headersToRecord(msg.payload?.headers ?? []);
  const from = headers["from"] ?? "";
  return {
    id: msg.id,
    threadId: msg.threadId ?? "",
    internalDate: msg.internalDate ? Number(msg.internalDate) : null,
    from,
    fromEmail: extractEmailAddress(from),
    to: headers["to"] ?? "",
    subject: decodeRfc2047(headers["subject"] ?? "").trim(),
    body: extractBodyText(msg.payload),
    headers,
  };
}

/** True for auto-generated messages (out-of-office, OOO, auto-replies). */
export function isAutoReply(
  headers: Record<string, string>,
  subject: string,
): boolean {
  const autoSubmitted = (headers["auto-submitted"] ?? "").toLowerCase();
  if (autoSubmitted.startsWith("auto-")) return true;
  const precedence = (headers["precedence"] ?? "").toLowerCase();
  if (precedence === "auto_reply" || precedence === "bulk" || precedence === "junk") {
    return true;
  }
  if ((headers["x-autoreply"] ?? "").toLowerCase() === "yes") return true;
  if (headers["x-auto-response-suppress"]) return true;
  if (headers["x-autorespond"]) return true;
  return /^(auto(matic)?\s*reply|automatic\s*reply|out\s*of\s*office|autoreply)\b/i.test(
    subject,
  );
}

/** True when the message is a delivery-failure / bounce notification. */
export function isBounce(
  fromEmail: string,
  subject: string,
  headers: Record<string, string>,
): boolean {
  if (/(mailer-daemon|postmaster|mailer-daemon@)/i.test(fromEmail)) return true;
  if (headers["x-failed-recipients"]) return true;
  if ((headers["return-path"] ?? "").trim() === "<>") return true;
  if (
    /delivery (status )?(notification|failure)|failure notice|undelivered mail|returned mail|remote host has closed/i.test(
      subject,
    )
  ) {
    return true;
  }
  return false;
}

/** True when the sender is unsubscribing (subject "unsubscribe" etc.). */
export function isUnsubscribe(fromEmail: string, subject: string): boolean {
  if (fromEmail.includes("unsubscribe")) return true;
  return /unsubscribe/i.test(subject);
}

/**
 * Reduce a Gmail thread to the messages that are plausibly replies to us:
 * - drops our own sent messages (anything from `sentFromEmail`),
 * - keeps messages from the lead's addresses,
 * - keeps delivery-failure notifications (bounces),
 * - classifies each survivor as auto-reply / bounce / unsubscribe.
 */
export function extractThreadReplies(
  thread: ThreadLike,
  opts: ExtractOptions,
): ReplyCandidate[] {
  const messages = thread?.messages ?? [];
  const sentFrom = normalizeEmail(opts.sentFromEmail);
  const leadEmails = new Set(opts.leadEmails.map(normalizeEmail));

  const candidates: ReplyCandidate[] = [];
  for (const msg of messages) {
    const parsed = parseGmailMessage(msg);
    if (!parsed) continue;

    const from = normalizeEmail(parsed.fromEmail);
    if (from === sentFrom) continue; // our own message

    const isBounceFlag = isBounce(parsed.fromEmail, parsed.subject, parsed.headers);
    if (!leadEmails.has(from) && !isBounceFlag) continue; // unrelated participant

    candidates.push({
      parsed,
      isAutoReply: isAutoReply(parsed.headers, parsed.subject),
      isBounce: isBounceFlag,
      isUnsubscribe: isUnsubscribe(parsed.fromEmail, parsed.subject),
    });
  }
  return candidates;
}
