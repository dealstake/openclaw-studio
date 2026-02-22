import { describe, it, expect } from "vitest";
import { extractImages } from "@/lib/text/extract-text";

describe("extractImages", () => {
  it("returns empty for non-object input", () => {
    expect(extractImages(null)).toEqual([]);
    expect(extractImages("string")).toEqual([]);
    expect(extractImages(undefined)).toEqual([]);
  });

  it("returns empty when content is not an array", () => {
    expect(extractImages({ content: "just text" })).toEqual([]);
    expect(extractImages({ content: null })).toEqual([]);
  });

  it("extracts Claude API base64 images", () => {
    const message = {
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: "iVBORw0KGgo=",
          },
        },
      ],
    };
    const images = extractImages(message);
    expect(images).toEqual([
      { src: "data:image/png;base64,iVBORw0KGgo=" },
    ]);
  });

  it("extracts Claude API URL images", () => {
    const message = {
      content: [
        {
          type: "image",
          source: { type: "url", url: "https://example.com/photo.jpg" },
        },
      ],
    };
    expect(extractImages(message)).toEqual([
      { src: "https://example.com/photo.jpg" },
    ]);
  });

  it("extracts OpenAI format image_url", () => {
    const message = {
      content: [
        { type: "image_url", image_url: { url: "https://example.com/img.png" } },
      ],
    };
    expect(extractImages(message)).toEqual([
      { src: "https://example.com/img.png" },
    ]);
  });

  it("extracts multiple images from mixed content", () => {
    const message = {
      content: [
        { type: "text", text: "Look at these" },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "abc" } },
        { type: "image_url", image_url: { url: "https://example.com/2.png" } },
      ],
    };
    const images = extractImages(message);
    expect(images).toHaveLength(2);
    expect(images[0]?.src).toBe("data:image/jpeg;base64,abc");
    expect(images[1]?.src).toBe("https://example.com/2.png");
  });

  it("skips non-image content items", () => {
    const message = {
      content: [
        { type: "text", text: "hello" },
        { type: "tool_use", id: "123" },
        null,
      ],
    };
    expect(extractImages(message)).toEqual([]);
  });
});
