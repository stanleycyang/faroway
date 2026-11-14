declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: string): void;
    toMatch(expected: RegExp | string): void;
    toMatchObject(expected: unknown): void;
    toHaveProperty(expected: string): void;
    toHaveLength(expected: number): void;
    toBeUndefined(): void;
    toBeInstanceOf(expected: unknown): void;
    toThrow(expected?: string | RegExp): void;
  }
  interface Expectation extends Matchers {
    not: Matchers;
    rejects: Matchers;
  }
  export function expect(value: unknown): Expectation;
  export namespace expect {
    function objectContaining(value: Record<string, unknown>): unknown;
  }
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export namespace test {
    function each<T>(
      cases: readonly T[],
    ): (name: string, fn: (value: T) => void | Promise<void>) => void;
  }
}
