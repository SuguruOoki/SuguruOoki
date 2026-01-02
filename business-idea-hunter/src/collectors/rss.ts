import Parser from "rss-parser";
import type { CollectedItem, Config, RSSSourceConfig } from "../types.js";
import { BaseCollector } from "./base.js";

export class RSSCollector extends BaseCollector {
  private parser: Parser;
  private sourceConfig: RSSSourceConfig;

  constructor(config: Config, sourceName: "note" | "zenn" | "hackernews" | "indiehackers" | "producthunt") {
    super(config, sourceName);
    this.parser = new Parser();
    this.sourceConfig = config.rss[sourceName];
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.sourceConfig.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const maxItems = this.config.collection.maxItemsPerSource;

    for (const feedUrl of this.sourceConfig.feeds) {
      try {
        const feed = await this.parser.parseURL(feedUrl);

        for (const entry of feed.items.slice(0, maxItems)) {
          const item = this.createItem({
            source: this.name,
            title: entry.title || "",
            content: this.cleanContent(entry.contentSnippet || entry.content || ""),
            url: entry.link || "",
            author: entry.creator || entry.author,
            metadata: {
              published: entry.pubDate,
              categories: entry.categories || [],
            },
          });
          items.push(item);
        }
      } catch (error) {
        console.error(`[${this.name}] Error fetching ${feedUrl}:`, error);
      }
    }

    // キーワードフィルタリング
    const filtered = this.filterByKeywords(items, this.sourceConfig.keywords);

    return filtered.slice(0, maxItems);
  }

  private cleanContent(content: string): string {
    // HTMLタグを除去
    let cleaned = content.replace(/<[^>]+>/g, "");
    cleaned = cleaned.trim();

    // 長すぎる場合は切り詰め
    if (cleaned.length > 1000) {
      cleaned = cleaned.slice(0, 1000) + "...";
    }

    return cleaned;
  }
}
