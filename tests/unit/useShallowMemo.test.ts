import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useShallowArrayMemo } from "@/lib/hooks/useShallowMemo";

describe("useShallowArrayMemo", () => {
  it("computes value on first render", () => {
    const arr = [1, 2, 3];
    const { result } = renderHook(() =>
      useShallowArrayMemo(() => arr.reduce((a, b) => a + b, 0), arr)
    );
    expect(result.current).toBe(6);
  });

  it("recomputes when array length changes", () => {
    let arr = [1, 2, 3];
    const { result, rerender } = renderHook(() =>
      useShallowArrayMemo(() => arr.length, arr)
    );
    expect(result.current).toBe(3);
    arr = [1, 2, 3, 4];
    rerender();
    expect(result.current).toBe(4);
  });

  it("recomputes when last element changes", () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    let arr = [obj1];
    const { result, rerender } = renderHook(() =>
      useShallowArrayMemo(() => arr[arr.length - 1], arr)
    );
    expect(result.current).toBe(obj1);
    arr = [obj2];
    rerender();
    expect(result.current).toBe(obj2);
  });
});
