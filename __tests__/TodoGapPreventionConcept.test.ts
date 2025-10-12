import { describe, expect, test } from "@jest/globals";

/**
 * Conceptual tests demonstrating gap prevention requirements
 * These tests define the expected behavior that our TodoService implementation should satisfy
 */

// Helper to check if a priority array has gaps
function hasGaps(priorities: number[]): boolean {
  const sorted = [...priorities].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      return true; // Gap found
    }
  }
  return false;
}

// Helper to simulate gap closure operation
function closeGap(priorities: number[], gapPosition: number): number[] {
  return priorities.map((p) => (p > gapPosition ? p - 1 : p));
}

// Helper to simulate priority bumping
function bumpPriorities(priorities: number[], fromPriority: number): number[] {
  return priorities.map((p) => (p >= fromPriority ? p + 1 : p));
}

describe("Gap Prevention Concept Tests", () => {
  test("should detect gaps correctly", () => {
    expect(hasGaps([1, 2, 3, 4])).toBe(false); // No gaps
    expect(hasGaps([1, 3, 4, 5])).toBe(true); // Gap at position 2
    expect(hasGaps([2, 3, 4, 5])).toBe(true); // Gap at position 1
    expect(hasGaps([1, 2, 4, 5])).toBe(true); // Gap at position 3
  });

  test("should close gaps correctly", () => {
    const priorities = [1, 2, 4, 5, 6]; // Gap at position 3
    const afterGapClosure = closeGap(priorities, 2); // Close gap left by deleting priority 2

    expect(afterGapClosure).toEqual([1, 2, 3, 4, 5]); // Gap closed
    expect(hasGaps(afterGapClosure)).toBe(false);
  });

  test("should bump priorities correctly", () => {
    const priorities = [1, 2, 3, 4];
    const afterBump = bumpPriorities(priorities, 2); // Insert at priority 2, bump 2+ to 3+

    expect(afterBump).toEqual([1, 3, 4, 5]); // Priorities 2,3,4 became 3,4,5

    // After inserting new item at priority 2
    const afterInsert = [...afterBump, 2].sort((a, b) => a - b);
    expect(afterInsert).toEqual([1, 2, 3, 4, 5]); // Dense sequence maintained
    expect(hasGaps(afterInsert)).toBe(false);
  });

  describe("Sequence Operations", () => {
    test("delete middle → gap closure maintains dense sequence", () => {
      let priorities = [1, 2, 3, 4, 5];

      // Delete priority 3
      priorities = priorities.filter((p) => p !== 3);
      expect(priorities).toEqual([1, 2, 4, 5]); // Gap exists
      expect(hasGaps(priorities)).toBe(true);

      // Close gap
      priorities = closeGap(priorities, 3);
      expect(priorities).toEqual([1, 2, 3, 4]); // Gap closed
      expect(hasGaps(priorities)).toBe(false);
    });

    test("insert middle → bump maintains dense sequence", () => {
      let priorities = [1, 2, 3, 4];

      // Insert at priority 2 (bump existing 2+ to 3+)
      priorities = bumpPriorities(priorities, 2);
      priorities.push(2); // Add new item
      priorities.sort((a, b) => a - b);

      expect(priorities).toEqual([1, 2, 3, 4, 5]); // Dense sequence
      expect(hasGaps(priorities)).toBe(false);
    });

    test("multiple operations maintain gap-free state", () => {
      let priorities = [1, 2, 3, 4, 5];

      // Delete priority 2
      priorities = priorities.filter((p) => p !== 2);
      priorities = closeGap(priorities, 2);
      expect(priorities).toEqual([1, 2, 3, 4]);
      expect(hasGaps(priorities)).toBe(false);

      // Insert at priority 1
      priorities = bumpPriorities(priorities, 1);
      priorities.push(1);
      priorities.sort((a, b) => a - b);
      expect(priorities).toEqual([1, 2, 3, 4, 5]);
      expect(hasGaps(priorities)).toBe(false);

      // Delete priority 4
      priorities = priorities.filter((p) => p !== 4);
      priorities = closeGap(priorities, 4);
      expect(priorities).toEqual([1, 2, 3, 4]);
      expect(hasGaps(priorities)).toBe(false);
    });
  });

  test("edge cases", () => {
    // Empty array
    expect(hasGaps([])).toBe(false);

    // Single item
    expect(hasGaps([1])).toBe(false);
    expect(hasGaps([5])).toBe(true); // Should start at 1

    // After closing gap in single-gap scenario
    const singleGap = [1, 3];
    expect(hasGaps(singleGap)).toBe(true);

    const afterClosure = closeGap(singleGap, 1); // Close gap after deleting priority 1
    expect(afterClosure).toEqual([1, 2]); // Priority 3 becomes 2
    expect(hasGaps(afterClosure)).toBe(false);
  });
});

/**
 * Expected behavior specification for TodoService:
 *
 * 1. createTodo(priority: N) should:
 *    - Bump all active todos with priority >= N to priority+1
 *    - Insert new todo at exactly priority N
 *    - Result: Dense sequence with no gaps
 *
 * 2. deleteTodo(id) should:
 *    - Remove todo from active list
 *    - If it was active, decrement all priorities > deletedPriority by 1
 *    - Result: Dense sequence with no gaps
 *
 * 3. updateTodo(id, {status: "completed"}) should:
 *    - Set todo.priority = null
 *    - Decrement all active priorities > oldPriority by 1
 *    - Result: Dense sequence with no gaps
 *
 * 4. updateTodo(id, {status: "active", priority: N}) should:
 *    - Bump all active todos with priority >= N to priority+1
 *    - Set todo.priority = N
 *    - Result: Dense sequence with no gaps
 *
 * 5. updateTodo(id, {priority: N}) (within active) should:
 *    - Close gap at old position (decrement priorities > oldPriority by 1)
 *    - Bump priorities at new position (increment priorities >= N by 1)
 *    - Set todo.priority = N
 *    - Result: Dense sequence with no gaps
 */
