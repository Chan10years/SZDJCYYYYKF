import { beforeEach, describe, expect, it } from "vitest";
import { consumeAiBudget, resetAiBudgetForTests } from "@/lib/aiBudget";

describe("process-level AI budget", () => {
  beforeEach(() => {
    resetAiBudgetForTests();
  });

  it("allows one full 60-user, three-round Challenge burst for one IP", () => {
    for (let request = 0; request < 180; request += 1) {
      expect(consumeAiBudget("challenge", "198.51.100.10")).toBe(true);
    }

    expect(consumeAiBudget("challenge", "198.51.100.10")).toBe(false);
  });

  it("keeps the classroom allowance finite", () => {
    for (let request = 0; request < 180; request += 1) {
      consumeAiBudget("challenge", "198.51.100.10");
    }

    expect(consumeAiBudget("challenge", "198.51.100.11")).toBe(false);
  });

  it("allows one Report request for each classroom user", () => {
    for (let request = 0; request < 60; request += 1) {
      expect(consumeAiBudget("report", "198.51.100.10")).toBe(true);
    }

    expect(consumeAiBudget("report", "198.51.100.10")).toBe(false);
  });
});
