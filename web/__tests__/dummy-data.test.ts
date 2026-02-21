import { describe, it, expect } from "vitest";
import {
  avatars,
  threads,
  getThreadMessages,
  getAvatarById,
} from "@/lib/dummy-data";

describe("dummy-data", () => {
  it("has at least 4 avatars", () => {
    expect(avatars.length).toBeGreaterThanOrEqual(4);
  });

  it("has at least 5 threads", () => {
    expect(threads.length).toBeGreaterThanOrEqual(5);
  });

  it("getAvatarById returns correct avatar", () => {
    const pf = getAvatarById("purplefrog");
    expect(pf).toBeDefined();
    expect(pf?.name).toBe("PurpleFrog");
  });

  it("getAvatarById returns undefined for unknown id", () => {
    expect(getAvatarById("nonexistent")).toBeUndefined();
  });

  it("getThreadMessages returns messages for existing thread", () => {
    const msgs = getThreadMessages("thread-1");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].role).toBe("user");
  });

  it("getThreadMessages returns empty array for unknown thread", () => {
    expect(getThreadMessages("nonexistent")).toEqual([]);
  });

  it("every thread references a valid avatar", () => {
    threads.forEach((t) => {
      expect(getAvatarById(t.avatarId)).toBeDefined();
    });
  });
});
