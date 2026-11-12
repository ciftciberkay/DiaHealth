import { describe, expect, it, vi } from "vitest";
import { createAssetCache } from "../src/assetCache";

describe("decoded image cache", () => {
  it("shares native image references across concurrent loads and screen revisits", async () => {
    const image = { nativeImage: "logo" };
    const load = vi.fn(async () => image);
    const cache = createAssetCache(load);

    await Promise.all([cache.preload([1, 1, 2]), cache.preload([1, 2])]);
    await cache.preload([1, 2]);

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.get(1)).toBe(image);
    expect(cache.get(2)).toBe(image);
  });

  it("keeps successful images and retries only failed assets", async () => {
    const image = { nativeImage: "icon" };
    const load = vi.fn()
      .mockResolvedValueOnce(image)
      .mockRejectedValueOnce(new Error("Unavailable asset"))
      .mockResolvedValueOnce(image);
    const cache = createAssetCache(load);

    const results = await cache.preload([1, 2]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(cache.get(1)).toBe(image);
    expect(cache.get(2)).toBe(2);

    await cache.preload([1, 2]);
    expect(load).toHaveBeenCalledTimes(3);
    expect(cache.get(2)).toBe(image);
  });

  it("waits for remaining images when another image fails", async () => {
    let complete: (image: object) => void = () => undefined;
    const remaining = new Promise<object>((resolve) => { complete = resolve; });
    const cache = createAssetCache(async (source) => {
      if (source === 1) {
        throw new Error("Unavailable asset");
      }
      return remaining;
    });
    let ready = false;
    const batch = cache.preload([1, 2]).then(() => { ready = true; });

    await cache.preload([1]);
    expect(ready).toBe(false);
    const image = { nativeImage: "remaining" };
    complete(image);
    await batch;
    expect(ready).toBe(true);
    expect(cache.get(2)).toBe(image);
  });
});
