import { describe, expect, it } from "vitest";

import { columnToLetter, parseSpreadsheetId } from "@/lib/google/sheets";

describe("parseSpreadsheetId", () => {
  it("extracts the id from a spreadsheet URL", () => {
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/1AbC123xYz-9/edit#gid=0",
      ),
    ).toBe("1AbC123xYz-9");
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/abcDEF_456/edit?usp=sharing",
      ),
    ).toBe("abcDEF_456");
  });

  it("accepts a bare spreadsheet id", () => {
    expect(parseSpreadsheetId("1AbC123xYz-9")).toBe("1AbC123xYz-9");
  });

  it("rejects strings that look like neither", () => {
    expect(() => parseSpreadsheetId("not a sheet")).toThrow(/Google Sheets URL/);
    expect(() => parseSpreadsheetId("short")).toThrow();
  });
});

describe("columnToLetter", () => {
  it("maps 1-indexed columns to A1 letters", () => {
    expect(columnToLetter(1)).toBe("A");
    expect(columnToLetter(26)).toBe("Z");
    expect(columnToLetter(27)).toBe("AA");
    expect(columnToLetter(52)).toBe("AZ");
    expect(columnToLetter(703)).toBe("AAA");
  });
});
