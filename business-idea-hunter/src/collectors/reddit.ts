import Parser from "rss-parser";
import type { CollectedItem, Config } from "../types.js";
import { BaseCollector } from "./base.js";

export class RedditCollector extends BaseCollector {
  private parser: Parser;

  constructor(config: Config) {
    super(config, "reddit");
    this.parser = new Parser();
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.config.reddit.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const maxItems = this.config.collection.maxItemsPerSource;

    for (const feedUrl of this.config.reddit.feeds) {
      try {
        console.log(`[reddit] Fetching ${feedUrl}`);
        const feed = await this.parser.parseURL(feedUrl);

        for (const entry of feed.items.slice(0, maxItems)) {
          // Reddit RSS の content には HTML が含まれる
          const content = this.cleanContent(entry.contentSnippet || entry.content || "");

          // Reddit の engagement を推定（RSS からは取得できないので 0）
          const item = this.createItem({
            source: "reddit",
            title: entry.title || "",
            content,
            url: entry.link || "",
            author: entry.author || entry.creator,
            engagement: 0, // RSS では取得不可
            metadata: {
              published: entry.pubDate,
              categories: entry.categories || [],
              subreddit: this.extractSubreddit(feedUrl),
            },
          });
          items.push(item);
        }
      } catch (error) {
        console.error(`[reddit] Error fetching ${feedUrl}:`, error);
      }
    }

    // キーワードフィルタリング
    const filtered = this.config.reddit.keywords.length > 0
      ? this.filterByKeywords(items, this.config.reddit.keywords)
      : items;

    return filtered.slice(0, maxItems);
  }

  private cleanContent(content: string): string {
    // HTMLタグを除去
    let cleaned = content.replace(/<[^>]+>/g, "");
    // HTMLエンティティをデコード
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
    cleaned = cleaned.trim();

    // 長すぎる場合は切り詰め
    if (cleaned.length > 1000) {
      cleaned = cleaned.slice(0, 1000) + "...";
    }

    return cleaned;
  }

  private extractSubreddit(feedUrl: string): string {
    // https://www.reddit.com/r/Entrepreneur/.rss から subreddit 名を抽出
    const match = feedUrl.match(/\/r\/([^\/]+)/);
    return match ? match[1] : "unknown";
  }
}
