import { chromium, type Browser } from "playwright";
import type { CollectedItem, Config } from "../types.js";
import { BaseCollector } from "./base.js";

/**
 * Instagramからクローリングでデータを収集
 * ⚠️ 注意: 利用規約違反の可能性があります。個人利用・研究目的に限定してください。
 * ログイン不要の公開データのみ取得します。
 */
export class InstagramCollector extends BaseCollector {
  constructor(config: Config) {
    super(config, "instagram");
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.config.instagram.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const { hashtags, maxPosts } = this.config.instagram;
    const maxItems = this.config.collection.maxItemsPerSource;
    const proxyUrl = process.env.PROXY_URL;

    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
        proxy: proxyUrl ? { server: proxyUrl } : undefined,
      });

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });

      const page = await context.newPage();

      for (const hashtag of hashtags) {
        try {
          // ハッシュタグページにアクセス
          const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;
          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(3000);

          // ログインモーダルを閉じる（あれば）
          try {
            const closeBtn = await page.$('svg[aria-label="Close"]');
            if (closeBtn) {
              await closeBtn.click();
              await page.waitForTimeout(1000);
            }
          } catch {
            // モーダルがなければ無視
          }

          // 投稿リンクを取得
          const postLinks = await page.$$('a[href^="/p/"]');

          for (const link of postLinks.slice(0, maxPosts)) {
            try {
              const href = await link.getAttribute("href");
              if (!href) continue;

              const postUrl = `https://www.instagram.com${href}`;

              // 個別投稿ページに移動
              await page.goto(postUrl, { waitUntil: "networkidle", timeout: 20000 });
              await page.waitForTimeout(2000);

              const item = await this.parsePost(page, postUrl, hashtag);
              if (item) {
                items.push(item);
              }
            } catch {
              continue;
            }
          }
        } catch (error) {
          console.error(`[instagram] Error fetching #${hashtag}:`, error);
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // 重複除去
    const seenUrls = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    });

    return uniqueItems.slice(0, maxItems);
  }

  private async parsePost(
    page: any,
    url: string,
    hashtag: string
  ): Promise<CollectedItem | null> {
    try {
      // メタタグからデータ取得
      const metaDesc = await page.$('meta[property="og:description"]');
      const description = metaDesc
        ? await metaDesc.getAttribute("content")
        : "";

      const metaTitle = await page.$('meta[property="og:title"]');
      const title = metaTitle ? await metaTitle.getAttribute("content") : "";

      if (!description) return null;

      // ユーザー名を抽出
      let author: string | undefined;
      if (title) {
        const match = title.match(/(.+?) on Instagram/);
        if (match) {
          author = match[1];
        }
      }

      // いいね数を取得（表示されていれば）
      let engagement = 0;
      try {
        const likesEl = await page.$("section span");
        if (likesEl) {
          const likesText = await likesEl.innerText();
          engagement = this.parseCount(likesText);
        }
      } catch {
        // 取得できなければ0
      }

      return this.createItem({
        source: "instagram",
        title: description.length > 100 ? description.slice(0, 100) + "..." : description,
        content: description,
        url,
        author,
        engagement,
        metadata: { hashtag },
      });
    } catch {
      return null;
    }
  }

  private parseCount(text: string): number {
    text = text.trim().toLowerCase();
    if (!text) return 0;

    try {
      const numbers = text.match(/[\d,]+/);
      if (numbers) {
        return parseInt(numbers[0].replace(/,/g, ""), 10);
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
