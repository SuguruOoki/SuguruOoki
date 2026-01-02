import type { CollectedItem, Config } from "../types.js";
import { BaseCollector } from "./base.js";

interface HNStory {
  id: number;
  title: string;
  text?: string;
  url?: string;
  by: string;
  score: number;
  descendants?: number;
  time: number;
  deleted?: boolean;
  dead?: boolean;
}

export class HackerNewsCollector extends BaseCollector {
  private readonly BASE_URL = "https://hacker-news.firebaseio.com/v0";

  constructor(config: Config) {
    super(config, "hackernews");
  }

  async collect(): Promise<CollectedItem[]> {
    if (!this.config.rss.hackernews.enabled) {
      return [];
    }

    const items: CollectedItem[] = [];
    const maxItems = this.config.collection.maxItemsPerSource;

    for (const storyType of ["showstories", "askstories"]) {
      try {
        // ストーリーIDリストを取得
        const idsResponse = await fetch(`${this.BASE_URL}/${storyType}.json`);
        const storyIds: number[] = await idsResponse.json();

        for (const storyId of storyIds.slice(0, maxItems)) {
          try {
            const storyResponse = await fetch(
              `${this.BASE_URL}/item/${storyId}.json`
            );
            const story: HNStory = await storyResponse.json();

            if (!story || story.deleted || story.dead) {
              continue;
            }

            const item = this.createItem({
              source: "hackernews",
              title: story.title || "",
              content: story.text ? story.text.slice(0, 1000) : "",
              url:
                story.url ||
                `https://news.ycombinator.com/item?id=${storyId}`,
              author: story.by,
              engagement: (story.score || 0) + (story.descendants || 0),
              metadata: {
                type: storyType.replace("stories", ""),
                score: story.score,
                comments: story.descendants || 0,
                createdUtc: new Date(story.time * 1000).toISOString(),
              },
            });
            items.push(item);
          } catch (error) {
            console.error(`[hackernews] Error fetching story ${storyId}:`, error);
          }
        }
      } catch (error) {
        console.error(`[hackernews] Error fetching ${storyType}:`, error);
      }
    }

    return items.slice(0, maxItems);
  }
}
