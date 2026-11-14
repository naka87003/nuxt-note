import { beforeEach, expect, it, vi } from "vitest";
import {
  createChatWebTools,
  webSourceLinks,
} from "../../../../server/utils/web-tools";
import { readWebpage } from "../../../../server/utils/web-page";

vi.mock("../../../../server/utils/web-page", () => ({ readWebpage: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it("checks generation ownership before reading a page", async () => {
  const assertActive = vi.fn().mockRejectedValue(new Error("inactive"));
  const tools = createChatWebTools({
    signal: new AbortController().signal,
    assertActive,
  });
  await expect(
    tools.read_webpage.execute!({ url: "https://example.com" }, {} as never),
  ).rejects.toThrow("inactive");
  expect(readWebpage).not.toHaveBeenCalled();
});

it("returns page data and sanitized failures so the model can try another source", async () => {
  const signal = new AbortController().signal;
  const tools = createChatWebTools({
    signal,
    assertActive: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(readWebpage).mockResolvedValueOnce({
    url: "https://example.com/",
    title: "Page",
    text: "Content",
    truncated: false,
  });
  expect(
    await tools.read_webpage.execute!(
      { url: "https://example.com" },
      {} as never,
    ),
  ).toMatchObject({ text: "Content" });
  expect(readWebpage).toHaveBeenCalledWith("https://example.com", signal);
  vi.mocked(readWebpage).mockRejectedValueOnce(
    new Error("private network detail"),
  );
  const result = await tools.read_webpage.execute!(
    { url: "https://example.com" },
    {} as never,
  );
  expect(result).toHaveProperty("error");
  expect(JSON.stringify(result)).not.toContain("private network detail");
});

it("propagates cancellation instead of returning an ordinary tool failure", async () => {
  const controller = new AbortController();
  const tools = createChatWebTools({
    signal: controller.signal,
    assertActive: vi.fn(),
  });
  controller.abort();
  await expect(
    tools.read_webpage.execute!({ url: "https://example.com" }, {} as never),
  ).rejects.toThrow();
  expect(readWebpage).not.toHaveBeenCalled();
});

it("formats safe clickable source links and excludes unsafe URLs", () => {
  const result = webSourceLinks(
    new Map([
      ["https://example.com/a(b)", "Title [link]\nnext"],
      ["javascript:alert(1)", "Bad"],
      ["not a URL", "Bad"],
    ]),
  );
  expect(result).toBe(
    "\n\nSources:\n- [Title \\[link\\] next](https://example.com/a%28b%29)",
  );
  expect(webSourceLinks(new Map())).toBe("");
});
