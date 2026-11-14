import { lookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Parser } from "htmlparser2";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 20_000;
const MAX_TITLE = 300;
const MAX_REDIRECTS = 3;
const READ_TIMEOUT_MS = 15_000;

type DownloadResult =
  | { type: "redirect"; location: string }
  | { type: "page"; body: string; html: boolean };

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, "ipv4")
    : family === 6 &&
        globalV6.check(address, "ipv6") &&
        !blocked.check(address, "ipv6");
}

export function webpageUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (isIP(hostname) && !isPublicAddress(hostname))
  )
    throw new Error("Only public HTTP(S) URLs on standard ports can be read.");
  url.hash = "";
  return url;
}

// Validate every DNS answer and pin the actual connection to a checked address.
// Redirects use this lookup again; no second, unchecked DNS lookup is performed.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicAddress(address))
    )
      return callback(new Error("Non-public destination."), []);
    const first = addresses[0]!;
    callback(null, options.all ? [first] : first.address, first.family);
  });
};

function download(url: URL, signal: AbortSignal): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        agent: false,
        lookup: publicLookup,
        signal,
        headers: {
          "User-Agent": "NuxtNote/1.0 (webpage reader)",
          Accept: "text/html, text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          response.headers.location
        ) {
          resolve({ type: "redirect", location: response.headers.location });
          response.destroy();
          return;
        }
        const type = response.headers["content-type"] ?? "";
        if (
          status < 200 ||
          status >= 300 ||
          !/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/i.test(
            type,
          ) ||
          (response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity") ||
          Number(response.headers["content-length"]) > MAX_BYTES
        ) {
          reject(new Error("Unsupported or unavailable page."));
          response.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            reject(new Error("Page is too large."));
            response.destroy();
          } else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("aborted", () =>
          reject(new Error("Page transfer interrupted.")),
        );
        response.on("end", () => {
          try {
            const charset =
              /charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1] ?? "utf-8";
            resolve({
              type: "page",
              body: new TextDecoder(charset).decode(Buffer.concat(chunks)),
              html: !/^text\/plain/i.test(type),
            });
          } catch {
            reject(new Error("Unsupported page encoding."));
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

export function extractWebpage(body: string, html: boolean) {
  let title = "";
  let text = "";
  if (html) {
    let ignored = 0;
    let inTitle = false;
    const hidden = new Set([
      "script",
      "style",
      "noscript",
      "template",
      "svg",
      "nav",
      "footer",
      "iframe",
    ]);
    const blocks =
      /^(p|div|article|section|main|h[1-6]|li|br|tr|pre|blockquote)$/;
    const parser = new Parser(
      {
        onopentag(name) {
          if (hidden.has(name)) ignored++;
          if (name === "title") inTitle = true;
          if (!ignored && blocks.test(name)) text += "\n";
        },
        ontext(value) {
          if (inTitle) title += value;
          else if (!ignored) text += value;
        },
        onclosetag(name) {
          if (hidden.has(name)) ignored--;
          if (name === "title") inTitle = false;
          if (!ignored && blocks.test(name)) text += "\n";
        },
      },
      { decodeEntities: true },
    );
    parser.end(body);
  } else text = body;
  text = text
    .replace(/[\t \r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    title: title.trim().slice(0, MAX_TITLE),
    text: text.slice(0, MAX_TEXT),
    truncated: text.length > MAX_TEXT,
  };
}

export async function readWebpage(value: string, signal: AbortSignal) {
  const deadline = AbortSignal.any([
    signal,
    AbortSignal.timeout(READ_TIMEOUT_MS),
  ]);
  let url = webpageUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    deadline.throwIfAborted();
    const result = await download(url, deadline);
    if (result.type === "redirect") {
      url = webpageUrl(new URL(result.location, url).href);
      continue;
    }
    const content = extractWebpage(result.body, result.html);
    if (!content.text) throw new Error("No readable page text.");
    return { url: url.href, ...content };
  }
  throw new Error("Too many redirects.");
}
