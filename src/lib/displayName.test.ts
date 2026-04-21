import { describe, it, expect } from "vitest";
import { getDisplayName } from "./displayName";

describe("getDisplayName", () => {
  it("returns work_name when set", () => {
    expect(getDisplayName({ work_name: "Jacob", full_name: "Santiago Jiménez" })).toBe("Jacob");
  });

  it("falls back to full_name when work_name is null", () => {
    expect(getDisplayName({ work_name: null, full_name: "Santiago Jiménez" })).toBe("Santiago Jiménez");
  });

  it("falls back to full_name when work_name is empty string", () => {
    expect(getDisplayName({ work_name: "", full_name: "Santiago Jiménez" })).toBe("Santiago Jiménez");
  });

  it("falls back to full_name when work_name is whitespace only", () => {
    expect(getDisplayName({ work_name: "   ", full_name: "Santiago Jiménez" })).toBe("Santiago Jiménez");
  });

  it("falls back to full_name when work_name is undefined", () => {
    expect(getDisplayName({ full_name: "Santiago Jiménez" })).toBe("Santiago Jiménez");
  });
});
