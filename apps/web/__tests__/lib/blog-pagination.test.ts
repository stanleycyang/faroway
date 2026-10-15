import { describe, expect, it } from "vitest";
import {
  blogIndexWindow,
  pageCount,
  parsePageParam,
  type BlogPostMeta,
} from "@/lib/blog";

function meta(slug: string, featured = false): BlogPostMeta {
  return {
    slug,
    title: slug,
    description: "",
    date: "2026-01-01",
    noindex: false,
    author: { name: "Faroway", avatar: "/icon.png", bio: "" },
    category: "Travel Tips",
    tags: [],
    coverImage: "/icon.png",
    readingTime: 1,
    featured,
  };
}

describe("blog pagination", () => {
  it("accepts only a positive integer page", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("2")).toBe(2);
    expect(parsePageParam("0")).toBeNull();
    expect(parsePageParam("-1")).toBeNull();
    expect(parsePageParam("1.5")).toBeNull();
    expect(parsePageParam("foo")).toBeNull();
    expect(parsePageParam("01")).toBeNull();
  });

  it("marks pages past the featured-excluded grid as out of range", () => {
    const posts = [
      meta("featured", true),
      ...Array.from({ length: 25 }, (_, index) => meta(`p${index}`)),
    ];
    const first = blogIndexWindow(posts, 1);
    expect(first.totalPages).toBe(pageCount(25));
    expect(first.outOfRange).toBe(false);
    expect(first.posts).toHaveLength(24);
    expect(first.posts.some((post) => post.slug === "featured")).toBe(false);

    const second = blogIndexWindow(posts, 2);
    expect(second.outOfRange).toBe(false);
    expect(second.posts.map((post) => post.slug)).toEqual(["p24"]);
    expect(second.currentPage).toBe(2);

    expect(blogIndexWindow(posts, 3).outOfRange).toBe(true);
    expect(blogIndexWindow(posts, 50).outOfRange).toBe(true);
    expect(blogIndexWindow([], 1).outOfRange).toBe(false);
    expect(blogIndexWindow([], 2).outOfRange).toBe(true);
  });
});
