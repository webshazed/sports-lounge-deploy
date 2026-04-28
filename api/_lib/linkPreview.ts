export type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  hostname: string;
};

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|::1$)/i;

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function validatePreviewUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new Error("Private URLs are not supported");
  }
  return parsed;
}

function readMeta(content: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attrRe = new RegExp(
    `<meta\\b(?=[^>]*(?:property|name|itemprop)=["']${escaped}["'])(?=[^>]*content=(["'])(.*?)\\1)[^>]*>`,
    "i"
  );
  return decodeHtml(content.match(attrRe)?.[2] || "");
}

function readTitle(content: string) {
  const title = content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtml(title.replace(/<[^>]+>/g, " "));
}

function absolutizeUrl(value: string | null, baseUrl: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value, baseUrl);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function readAttribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
  if (quoted) return decodeHtml(quoted);

  const unquoted = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i"))?.[1];
  return unquoted ? decodeHtml(unquoted) : "";
}

function bestSrcFromSrcset(srcset: string, baseUrl: string) {
  if (!srcset) return null;

  let best: { url: string; score: number } | null = null;
  for (const part of srcset.split(",")) {
    const [rawUrl, rawSize] = part.trim().split(/\s+/, 2);
    const url = absolutizeUrl(rawUrl, baseUrl);
    if (!url) continue;

    const score = Number(rawSize?.replace(/[^\d.]/g, "") || "0");
    if (!best || score > best.score) best = { url, score };
  }

  return best?.url || null;
}

function titleTokens(title: string | null) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !["sports", "lounge", "club", "home", "page"].includes(token))
    .slice(0, 6);
}

function findFallbackImage(html: string, baseUrl: string, title: string | null) {
  const tokens = titleTokens(title);
  let best: { url: string; score: number } | null = null;

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = readAttribute(tag, "src");
    const srcset = readAttribute(tag, "srcset");
    const lazySrc = readAttribute(tag, "data-lazy-src") || readAttribute(tag, "data-src");
    const lazySrcset = readAttribute(tag, "data-lazy-srcset") || readAttribute(tag, "data-srcset");
    const imageUrl =
      bestSrcFromSrcset(srcset, baseUrl) ||
      bestSrcFromSrcset(lazySrcset, baseUrl) ||
      absolutizeUrl(lazySrc, baseUrl) ||
      absolutizeUrl(src, baseUrl);
    if (!imageUrl) continue;

    const lower = imageUrl.toLowerCase();
    const hasImageExtension = /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i.test(imageUrl);
    if (
      !hasImageExtension ||
      lower.startsWith("data:") ||
      lower.includes("<%") ||
      lower.includes("%3c") ||
      lower.includes("%22%22") ||
      lower.includes("/%22") ||
      lower.includes("/dummy.") ||
      lower.includes("dummy.png") ||
      lower.includes("/placeholder") ||
      lower.includes("/vi/id/")
    ) {
      continue;
    }

    const width = Number(readAttribute(tag, "width") || "0");
    const height = Number(readAttribute(tag, "height") || "0");
    const area = width > 0 && height > 0 ? Math.min(width * height, 220_000) : 40_000;
    const context = html.slice(Math.max(0, match.index - 600), Math.min(html.length, match.index + tag.length + 600)).toLowerCase();

    let score = area;
    if (tokens.some((token) => context.includes(token))) score += 220_000;
    if (lower.match(/\b(logo|icon|favicon|cropped-|avatar|profile-avatar)\b/)) score -= 180_000;
    if (lower.match(/\b(300x300|150x150|270x270)\b/)) score -= 20_000;
    if (lower.match(/\.(svg)(\?|$)/)) score -= 80_000;

    if (!best || score > best.score) {
      best = { url: imageUrl, score };
    }
  }

  return best && best.score > 80_000 ? best.url : null;
}

export async function fetchPreviewImage(rawUrl: string) {
  const parsed = validatePreviewUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "SportsLoungeBot/1.0 (+https://sportslounge.club)",
      },
    });

    if (!response.ok) {
      throw new Error(`Image request failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error("URL did not return an image");
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 8_000_000) {
      throw new Error("Image is too large");
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > 8_000_000) {
      throw new Error("Image is too large");
    }

    return {
      body,
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData> {
  const parsed = validatePreviewUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "SportsLoungeBot/1.0 (+https://sportslounge.club)",
      },
    });

    if (!response.ok) {
      throw new Error(`Preview request failed with ${response.status}`);
    }

    const finalUrl = response.url || parsed.toString();
    const html = (await response.text()).slice(0, 350_000);
    const finalParsed = validatePreviewUrl(finalUrl);
    const title = readMeta(html, "og:title") || readMeta(html, "twitter:title") || readTitle(html) || null;
    const description =
      readMeta(html, "og:description") || readMeta(html, "twitter:description") || readMeta(html, "description") || null;
    const socialImage =
      readMeta(html, "og:image:secure_url") ||
      readMeta(html, "og:image:url") ||
      readMeta(html, "og:image") ||
      readMeta(html, "twitter:image:src") ||
      readMeta(html, "twitter:image") ||
      readMeta(html, "thumbnail") ||
      readMeta(html, "image") ||
      null;
    const image = absolutizeUrl(socialImage, finalUrl) || findFallbackImage(html, finalUrl, title);
    const siteName = readMeta(html, "og:site_name") || finalParsed.hostname.replace(/^www\./, "") || null;

    return {
      url: finalUrl,
      title,
      description,
      image,
      siteName,
      hostname: finalParsed.hostname.replace(/^www\./, ""),
    };
  } finally {
    clearTimeout(timer);
  }
}
