import { chromium, type Browser, type Page } from "playwright";
import type { CollectedItem, Config } from "../types.js";
import { BaseCollector } from "./base.js";

/**
 * X (Twitter) からクローリングでデータを収集
 * ⚠️ 注意: 利用規約違反の可能性があります。個人利用・研究目的に限定してください。
 */
export class XCollector extends BaseCollector {
  constructor(config: Config) {
    super(config, "x");
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.config.x.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const { searchQueries, maxScroll } = this.config.x;
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

      for (const query of searchQueries) {
        try {
          const encodedQuery = encodeURIComponent(query);
          const url = `https://x.com/search?q=${encodedQuery}&src=typed_query&f=live`;

          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(3000);

          // スクロールして追加コンテンツを読み込み
          for (let i = 0; i < maxScroll; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
          }

          // ツイートを抽出
          const tweets = await page.$$('article[data-testid="tweet"]');

          for (const tweet of tweets.slice(0, maxItems)) {
            try {
              const item = await this.parseTweet(tweet, query);
              if (item) {
                items.push(item);
              }
            } catch {
              continue;
            }
          }
        } catch (error) {
          console.error(`[x] Error searching '${query}':`, error);
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // 重複除去（URL基準）
    const seenUrls = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    });

    return uniqueItems.slice(0, maxItems);
  }

  private async parseTweet(
    tweet: any,
    query: string
  ): Promise<CollectedItem | null> {
    try {
      // テキスト取得
      const textEl = await tweet.$('[data-testid="tweetText"]');
      const text = textEl ? await textEl.innerText() : "";

      if (!text) return null;

      // ユーザー名取得
      const userEl = await tweet.$('a[href^="/"][role="link"] span');
      const author = userEl ? await userEl.innerText() : undefined;

      // リンク取得
      let url = "";
      const timeEl = await tweet.$("time");
      if (timeEl) {
        const parent = await timeEl.evaluateHandle((el: HTMLElement) => el.parentElement);
        const href = await parent.evaluate((el: HTMLElement) => el.getAttribute("href"));
        url = href ? `https://x.com${href}` : "";
      }

      // エンゲージメント（概算）
      let engagement = 0;
      for (const testid of ["reply", "retweet", "like"]) {
        const el = await tweet.$(`[data-testid="${testid}"]`);
        if (el) {
          const countText = await el.innerText();
          engagement += this.parseCount(countText);
        }
      }

      return this.createItem({
        source: "x",
        title: text.length > 100 ? text.slice(0, 100) + "..." : text,
        content: text,
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
