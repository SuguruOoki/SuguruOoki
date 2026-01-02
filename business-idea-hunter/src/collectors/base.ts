import type { CollectedItem, Collector, Config } from "../types.js";

export abstract class BaseCollector implements Collector {
  name: string;
  protected config: Config;

  constructor(config: Config, name: string) {
    this.config = config;
    this.name = name;
  }

  abstract collect(): Promise<CollectedItem[]>;

  protected filterByKeywords(
    items: CollectedItem[],
    keywords: string[]
  ): CollectedItem[] {
    if (keywords.length === 0) return items;

    return items.filter((item) => {
      const text = `${item.title} ${item.content}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw.toLowerCase()));
    });
  }

  protected filterByEngagement(
    items: CollectedItem[],
    minEngagement: number
  ): CollectedItem[] {
    return items.filter((item) => item.engagement >= minEngagement);
  }

  protected excludeKeywords(
    items: CollectedItem[],
    exclude: string[]
  ): CollectedItem[] {
    if (exclude.length === 0) return items;

    return items.filter((item) => {
      const text = `${item.title} ${item.content}`.toLowerCase();
      return !exclude.some((kw) => text.includes(kw.toLowerCase()));
    });
  }

  protected createItem(
    partial: Partial<CollectedItem> & {
      source: string;
      title: string;
      content: string;
      url: string;
    }
  ): CollectedItem {
    return {
      engagement: 0,
      collectedAt: new Date(),
      metadata: {},
      ...partial,
    };
  }
}
