import { describe, expect, test } from "@jest/globals";

describe("Simple Test", () => {
  test("should work without any imports", () => {
    expect(1 + 1).toBe(2);
  });
});
