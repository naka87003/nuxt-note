import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import {
  extractWebpage,
  isPublicAddress,
  readWebpage,
  webpageUrl,
} from "../../../../server/utils/web-page";

const mocks = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn() }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
vi.mock("node:dns", () => ({ lookup: mocks.lookup }));

function respond(
  status = 200,
  headers: Record<string, string> = { "content-type": "text/html" },
  chunks = [Buffer.from("<title>Test</title><p>Page</p>")],
) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const response = Object.assign(new EventEmitter(), {
      statusCode: status,
      headers,
      destroy: vi.fn(),
    });
    return Object.assign(new EventEmitter(), {
      end: () =>
        queueMicrotask(() => {
          callback(response);
          for (const chunk of chunks) response.emit("data", chunk);
          response.emit("end");
        }),
    });
  });
}
beforeEach(() => vi.resetAllMocks());

it.each([
  "127.0.0.1",
  "0.0.0.0",
  "10.0.0.1",
  "172.16.0.1",
  "192.168.1.1",
  "100.100.100.200",
  "169.254.169.254",
  "192.0.2.1",
  "198.18.0.1",
  "224.0.0.1",
  "255.255.255.255",
  "::1",
  "::",
  "fe80::1",
  "fc00::1",
  "::ffff:127.0.0.1",
  "::ffff:8.8.8.8",
  "2002:7f00:1::",
  "2001:db8::1",
  "2001::1",
  "3fff::1",
  "not-an-ip",
])("rejects non-public address %s", (address) =>
  expect(isPublicAddress(address)).toBe(false),
);

it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
  "accepts public address %s",
  (address) => expect(isPublicAddress(address)).toBe(true),
);

it.each([
  "file:///etc/passwd",
  "ftp://example.com",
  "https://user:pass@example.com",
  "https://example.com:3000",
  "http://localhost",
  "http://app.localhost",
  "http://127.1",
  "http://2130706433",
  "http://0x7f000001",
  "http://[::1]",
  "http://[::ffff:127.0.0.1]",
  "http://169.254.169.254/latest/meta-data",
])("rejects unsafe URL %s before connecting", async (url) => {
  expect(() => webpageUrl(url)).toThrow();
  await expect(
    readWebpage(url, new AbortController().signal),
  ).rejects.toThrow();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("decodes HTML entities, preserves paragraphs and excludes non-content elements", () => {
  expect(
    extractWebpage(
      "<html><head><title>A &amp; B</title><style>hidden</style></head><body><nav>Menu</nav><main><h1>Heading</h1><p>Hello &lt;world&gt; &#x65e5;&#26412;</p><script>secret()</script><p>Next <strong>paragraph</strong>.</p></main><footer>Footer</footer></body></html>",
      true,
    ),
  ).toEqual({
    title: "A & B",
    text: "Heading\n\nHello <world> 日本\n\nNext paragraph.",
    truncated: false,
  });
});

it("marks truncated text and leaves plain text markup intact", () => {
  expect(extractWebpage("x".repeat(20_001), false)).toMatchObject({
    text: "x".repeat(20_000),
    truncated: true,
  });
  expect(extractWebpage("<example> &amp;", false).text).toBe("<example> &amp;");
});

it("returns final URL and text, without forwarding session headers", async () => {
  respond();
  expect(
    await readWebpage(
      "https://example.com/page#fragment",
      new AbortController().signal,
    ),
  ).toEqual({
    url: "https://example.com/page",
    title: "Test",
    text: "Page",
    truncated: false,
  });
  const options = mocks.request.mock.calls[0]![1];
  expect(options.agent).toBe(false);
  expect(options.headers).not.toHaveProperty("Cookie");
  expect(options.headers).not.toHaveProperty("Authorization");
  mocks.lookup.mockImplementation((_hostname, _options, callback) =>
    callback(null, [{ address: "8.8.8.8", family: 4 }]),
  );
  const callback = vi.fn();
  options.lookup("example.com", {}, callback);
  expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  options.lookup("example.com", { all: true }, callback);
  expect(callback).toHaveBeenLastCalledWith(
    null,
    [{ address: "8.8.8.8", family: 4 }],
    4,
  );
});

it("rejects DNS answers containing any private address", async () => {
  respond();
  await readWebpage("https://example.com", new AbortController().signal);
  mocks.lookup.mockImplementation((_hostname, _options, callback) =>
    callback(null, [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  );
  const callback = vi.fn();
  mocks.request.mock.calls[0]![1].lookup("example.com", {}, callback);
  expect(callback.mock.calls[0]![0]).toBeInstanceOf(Error);
});

it("follows relative redirects and checks every redirected destination", async () => {
  respond(302, { "content-type": "text/html", location: "/article" });
  respond();
  expect(
    await readWebpage("https://example.com", new AbortController().signal),
  ).toMatchObject({ url: "https://example.com/article" });
  expect(mocks.request).toHaveBeenCalledTimes(2);
  respond(302, { location: "http://169.254.169.254/" });
  await expect(
    readWebpage("https://example.com", new AbortController().signal),
  ).rejects.toThrow();
  expect(mocks.request).toHaveBeenCalledTimes(3);
});

it("limits redirect loops", async () => {
  for (let n = 0; n < 4; n++) respond(302, { location: "/loop" });
  await expect(
    readWebpage("https://example.com", new AbortController().signal),
  ).rejects.toThrow("Too many redirects");
  expect(mocks.request).toHaveBeenCalledTimes(4);
});

it.each([
  [403, { "content-type": "text/html" }],
  [200, { "content-type": "application/pdf" }],
  [200, { "content-type": "text/html", "content-encoding": "gzip" }],
  [200, { "content-type": "text/html", "content-length": "3000000" }],
])(
  "rejects unavailable, unsupported and oversized pages",
  async (status, headers) => {
    respond(status, headers);
    await expect(
      readWebpage("https://example.com", new AbortController().signal),
    ).rejects.toThrow();
  },
);

it("bounds chunked response size even without content-length", async () => {
  respond(200, { "content-type": "text/plain" }, [
    Buffer.alloc(2 * 1024 * 1024),
    Buffer.from("x"),
  ]);
  await expect(
    readWebpage("https://example.com", new AbortController().signal),
  ).rejects.toThrow("too large");
});

it("honors cancellation before making a request", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    readWebpage("https://example.com", controller.signal),
  ).rejects.toThrow();
  expect(mocks.request).not.toHaveBeenCalled();
});

it.each(["user cancellation", "deadline"])(
  "aborts an in-flight request on %s",
  async (reason) => {
    const user = new AbortController();
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    try {
      mocks.request.mockImplementation((_url, options) => {
        const request = Object.assign(new EventEmitter(), { end: vi.fn() });
        options.signal.addEventListener(
          "abort",
          () => request.emit("error", new Error("aborted")),
          { once: true },
        );
        return request;
      });
      const reading = readWebpage("https://example.com", user.signal);
      const rejection = expect(reading).rejects.toThrow("aborted");
      expect(timeout).toHaveBeenCalledWith(15_000);
      (reason === "deadline" ? deadline : user).abort();
      await rejection;
    } finally {
      timeout.mockRestore();
    }
  },
);
