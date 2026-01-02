import { chromium, type Browser } from "playwright";
import type { CollectedItem, Config } from "../types.js";
import { BaseCollector } from "./base.js";

/**
 * TikTokからクローリングでデータを収集
 * ⚠️ 注意: 利用規約違反の可能性があります。個人利用・研究目的に限定してください。
 */
export class TikTokCollector extends BaseCollector {
  constructor(config: Config) {
    super(config, "tiktok");
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.config.tiktok.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const { searchQueries, maxVideos } = this.config.tiktok;
    const maxItems = this.config.collection.maxItemsPerSource;
    const proxyUrl = process.env.PROXY_URL;

    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
        ],
        proxy: proxyUrl ? { server: proxyUrl } : undefined,
      });

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });

      const page = await context.newPage();

      for (const query of searchQueries) {
        try {
          // TikTok検索ページにアクセス
          const encodedQuery = encodeURIComponent(query);
          const url = `https://www.tiktok.com/search?q=${encodedQuery}`;

          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(5000); // TikTokは動的読み込みが遅い

          // スクロールしてコンテンツ読み込み
          for (let i = 0; i < 2; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
          }

          // 動画カードを取得
          let videoCards = await page.$$('[data-e2e="search_top-item"]');

          if (videoCards.length === 0) {
            // 別のセレクタを試す
            videoCards = await page.$$('[class*="DivItemContainerV2"]');
          }

          for (const card of videoCards.slice(0, maxVideos)) {
            try {
              const item = await this.parseVideoCard(card, query);
              if (item) {
                items.push(item);
              }
            } catch {
              continue;
            }
          }
        } catch (error) {
          console.error(`[tiktok] Error searching '${query}':`, error);
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

  private async parseVideoCard(
    card: any,
    query: string
  ): Promise<CollectedItem | null> {
    try {
      // リンク取得
      const link = await card.$('a[href*="/video/"]');
      if (!link) return null;

      let url = await link.getAttribute("href");
      if (!url) return null;

      if (!url.startsWith("http")) {
        url = `https://www.tiktok.com${url}`;
      }

      // 説明文取得
      let descEl = await card.$('[data-e2e="search-card-desc"]');
      if (!descEl) {
        descEl = await card.$('[class*="SpanText"]');
      }

      const description = descEl ? await descEl.innerText() : "";

      if (!description) return null;

      // ユーザー名取得
      let authorEl = await card.$('[data-e2e="search-card-user-unique-id"]');
      if (!authorEl) {
        authorEl = await card.$('a[href^="/@"]');
      }

      const author = authorEl ? await authorEl.innerText() : undefined;

      // エンゲージメント
      let engagement = 0;
      const statEls = await card.$$('[class*="StrongVideoCount"]');
      for (const stat of statEls) {
        try {
          const countText = await stat.innerText();
          engagement += this.parseCount(countText);
        } catch {
          continue;
        }
      }

      return this.createItem({
        source: "tiktok",
        title: description.length > 100 ? description.slice(0, 100) + "..." : description,
        content: description,
        url,
        author,
        engagement,
        metadata: { query },
      });
    } catch {
      return null;
    }
  }

  private parseCount(text: string): number {
    text = text.trim().toLowerCase();
    if (!text) return 0;

    try {
      if (text.includes("k")) {
        return Math.floor(parseFloat(text.replace("k", "")) * 1000);
      } else if (text.includes("m")) {
        return Math.floor(parseFloat(text.replace("m", "")) * 1000000);
      } else {
        return parseInt(text.replace(/[^\d]/g, ""), 10) || 0;
      }
    } catch {
      return 0;
    }
  }
}
