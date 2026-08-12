import { describe, it, expect } from "vitest";

import {
  decodeRfc2047,
  extractEmailAddress,
  extractThreadReplies,
  isAutoReply,
  isBounce,
  isUnsubscribe,
  normalizeEmail,
  parseGmailMessage,
  stripHtml,
  type GmailMessageLike,
  type ThreadLike,
} from "./extract";

const b64 = (text: string): string => Buffer.from(text, "utf8").toString("base64url");

function message(overrides: Partial<GmailMessageLike> & { id: string }): GmailMessageLike {
  return {
    threadId: "thread-1",
    internalDate: "1736100000000",
    ...overrides,
  };
}

function withHeaders(id: string, headers: Record<string, string>, body = "hello"): GmailMessageLike {
  return message({
    id,
    payload: {
      mimeType: "text/plain",
      headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
      body: { data: b64(body) },
    },
  });
}

const LEAD = { from: "Ada Lovelace <ada@example.com>", to: "sender@company.com" };
const SENDER = { from: "Our Sender <sender@company.com>", to: "ada@example.com" };

describe("normalizeEmail / extractEmailAddress", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("pulls the address out of a display-name form", () => {
    expect(extractEmailAddress("Ada Lovelace <ada@example.com>")).toBe("ada@example.com");
    expect(extractEmailAddress("ada@example.com")).toBe("ada@example.com");
  });
});

describe("decodeRfc2047", () => {
  it("decodes base64 encoded-words", () => {
    const enc = b64("Re: thanks");
    expect(decodeRfc2047(`=?utf-8?B?${enc}?=`)).toBe("Re: thanks");
  });

  it("decodes Q-encoded words", () => {
    expect(decodeRfc2047("=?utf-8?Q?Re:_thanks?=")).toBe("Re: thanks");
  });

  it("leaves plain headers alone", () => {
    expect(decodeRfc2047("Re: hello")).toBe("Re: hello");
  });
});

describe("stripHtml", () => {
  it("turns tags into readable text", () => {
    expect(stripHtml("<p>Hello<br/>there&nbsp;</p>")).toBe("Hello\nthere");
  });
});

describe("parseGmailMessage", () => {
  it("extracts fields and flattens headers to lowercase", () => {
    const parsed = parseGmailMessage(
      withHeaders("msg-1", { ...LEAD, "Auto-Submitted": "auto-replied", subject: "Re: hi" }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe("msg-1");
    expect(parsed!.fromEmail).toBe("ada@example.com");
    expect(parsed!.subject).toBe("Re: hi");
    expect(parsed!.body).toBe("hello");
    expect(parsed!.headers["auto-submitted"]).toBe("auto-replied");
    expect(parsed!.internalDate).toBe(1736100000000);
  });

  it("returns null for messages without an id", () => {
    expect(parseGmailMessage({})).toBeNull();
  });

  it("falls back to an HTML body", () => {
    const parsed = parseGmailMessage(
      message({
        id: "msg-html",
        payload: {
          mimeType: "text/html",
          body: { data: b64("<p>Hi <b>there</b></p>") },
        },
      }),
    );
    expect(parsed!.body).toBe("Hi there");
  });
});

describe("isAutoReply", () => {
  it("flags Auto-Submitted: auto-replied", () => {
    expect(isAutoReply({ "auto-submitted": "auto-replied" }, "Re: hi")).toBe(true);
  });
  it("flags Precedence: auto_reply", () => {
    expect(isAutoReply({ precedence: "auto_reply" }, "Re: hi")).toBe(true);
  });
  it("flags out-of-office subjects", () => {
    expect(isAutoReply({}, "Out of office: until Monday")).toBe(true);
    expect(isAutoReply({}, "Automatic reply: thanks")).toBe(true);
  });
  it("does not flag a normal reply", () => {
    expect(isAutoReply({}, "Re: your email")).toBe(false);
  });
});

describe("isBounce", () => {
  it("flags mailer-daemon senders", () => {
    expect(isBounce("mailer-daemon@example.com", "Delivery failed", {})).toBe(true);
    expect(isBounce("postmaster@example.com", "Undelivered", {})).toBe(true);
  });
  it("flags failure subjects and X-Failed-Recipients", () => {
    expect(isBounce("noreply@example.com", "Delivery Status Notification (Failure)", {})).toBe(true);
    expect(isBounce("noreply@example.com", "Hi", { "x-failed-recipients": "ada@example.com" })).toBe(true);
  });
  it("does not flag a normal reply", () => {
    expect(isBounce("ada@example.com", "Re: hi", {})).toBe(false);
  });
});

describe("isUnsubscribe", () => {
  it("flags unsubscribe subjects and addresses", () => {
    expect(isUnsubscribe("ada@example.com", "unsubscribe")).toBe(true);
    expect(isUnsubscribe("unsubscribe@example.com", "Re: hi")).toBe(true);
  });
  it("does not flag a normal reply", () => {
    expect(isUnsubscribe("ada@example.com", "Re: pricing")).toBe(false);
  });
});

describe("extractThreadReplies", () => {
  const opts = { sentFromEmail: "sender@company.com", leadEmails: ["ada@example.com"] };

  it("keeps lead replies and skips our own messages", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("reply-1", { ...LEAD, subject: "Re: Intro" }, "yes, interested!"),
      ],
    };
    const candidates = extractThreadReplies(thread, opts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].parsed.id).toBe("reply-1");
    expect(candidates[0].isAutoReply).toBe(false);
    expect(candidates[0].isBounce).toBe(false);
    expect(candidates[0].isUnsubscribe).toBe(false);
  });

  it("skips messages from unrelated participants", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("reply-1", { ...LEAD, subject: "Re: Intro" }),
        withHeaders("noise-1", { from: "colleague@other.com", to: "ada@example.com" }, "forwarded you this"),
      ],
    };
    const candidates = extractThreadReplies(thread, opts);
    expect(candidates.map((c) => c.parsed.id)).toEqual(["reply-1"]);
  });

  it("keeps bounces even though the sender is not the lead", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("bounce-1", {
          from: "MAILER-DAEMON@mx.example.com",
          to: "sender@company.com",
          subject: "Delivery Status Notification (Failure)",
        }),
      ],
    };
    const candidates = extractThreadReplies(thread, opts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].isBounce).toBe(true);
  });

  it("flags auto-replies from the lead", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("ooo-1", {
          ...LEAD,
          subject: "Out of office",
          "Auto-Submitted": "auto-replied",
        }),
      ],
    };
    const candidates = extractThreadReplies(thread, opts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].isAutoReply).toBe(true);
  });

  it("flags unsubscribe replies", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("unsub-1", { ...LEAD, subject: "unsubscribe" }, "remove me"),
      ],
    };
    const candidates = extractThreadReplies(thread, opts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].isUnsubscribe).toBe(true);
    expect(candidates[0].isAutoReply).toBe(false);
  });

  it("orders candidates by their appearance in the thread", () => {
    const thread: ThreadLike = {
      messages: [
        withHeaders("sent-1", { ...SENDER, subject: "Intro" }),
        withHeaders("reply-1", { ...LEAD, subject: "Re: Intro" }, "first"),
        withHeaders("reply-2", { ...LEAD, subject: "Re: Intro" }, "second"),
      ],
    };
    expect(extractThreadReplies(thread, opts).map((c) => c.parsed.id)).toEqual([
      "reply-1",
      "reply-2",
    ]);
  });
});
