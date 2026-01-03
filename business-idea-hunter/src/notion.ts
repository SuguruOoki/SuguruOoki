import type { BusinessIdea } from "./types.js";

const NOTION_API_VERSION = "2025-09-03";
const NOTION_BASE_URL = "https://api.notion.com/v1";

export class NotionDatabase {
  private apiKey: string;
  private databaseId: string;
  private dataSourceId: string | null = null;

  constructor() {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey) {
      throw new Error("NOTION_API_KEY not set");
    }
    if (!databaseId) {
      throw new Error("NOTION_DATABASE_ID not set");
    }

    this.apiKey = apiKey;
    this.databaseId = databaseId;
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    body?: unknown
  ): Promise<unknown> {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
      },
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${NOTION_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  private async getDataSourceId(): Promise<string> {
    if (this.dataSourceId) {
      return this.dataSourceId;
    }

    // Get database info to retrieve data_source_id
    const database = (await this.request(
      `/databases/${this.databaseId}`,
      "GET"
    )) as { data_sources?: Array<{ id: string }> };

    if (database.data_sources && database.data_sources.length > 0) {
      this.dataSourceId = database.data_sources[0].id;
      console.log(`[notion] Using data_source_id: ${this.dataSourceId}`);
      return this.dataSourceId;
    }

    // Fallback to database_id if no data_sources (single source database)
    console.log(`[notion] No data_sources found, using database_id as fallback`);
    this.dataSourceId = this.databaseId;
    return this.dataSourceId;
  }

  async saveIdeas(ideas: BusinessIdea[]): Promise<string[]> {
    const createdIds: string[] = [];

    // Get data_source_id before creating pages
    const dataSourceId = await this.getDataSourceId();

    for (const idea of ideas) {
      try {
        const page = await this.createPage(idea, dataSourceId);
        createdIds.push((page as { id: string }).id);
        console.log(`[notion] Created: ${idea.title}`);
      } catch (error) {
        console.error("[notion] Error creating page:", error);
      }
    }

    return createdIds;
  }

  private async createPage(
    idea: BusinessIdea,
    dataSourceId: string
  ): Promise<unknown> {
    const properties: Record<string, unknown> = {
      Title: {
        title: [
          {
            text: {
              content: idea.title.slice(0, 100),
            },
          },
        ],
      },
      Source: {
        select: {
          name: idea.originalSource || "unknown",
        },
      },
      Category: {
        select: {
          name: idea.category || "その他",
        },
      },
      "Pain Point": {
        rich_text: [
          {
            text: {
              content: (idea.painPoint || "").slice(0, 2000),
            },
          },
        ],
      },
      Idea: {
        rich_text: [
          {
            text: {
              content: (idea.idea || "").slice(0, 2000),
            },
          },
        ],
      },
      Potential: {
        select: {
          name: idea.potential || "Medium",
        },
      },
      "Original URL": {
        url: idea.originalUrl || null,
      },
      "Collected At": {
        date: {
          start: idea.collectedAt || new Date().toISOString(),
        },
      },
    };

    // 理由はページ本文に追加
    const children: unknown[] = [];
    if (idea.potentialReason) {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [
            { type: "text", text: { content: "ポテンシャル判定理由" } },
          ],
        },
      });
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: idea.potentialReason } }],
        },
      });
    }

    // Use data_source_id for multi-source databases (API 2025-09-03)
    return this.request("/pages", "POST", {
      parent: {
        type: "data_source_id",
        data_source_id: dataSourceId,
      },
      properties,
      children: children.length > 0 ? children : undefined,
    });
  }

  async checkDuplicate(url: string): Promise<boolean> {
    try {
      const dataSourceId = await this.getDataSourceId();
      const response = (await this.request(
        `/data_sources/${dataSourceId}/query`,
        "POST",
        {
          filter: {
            property: "Original URL",
            url: {
              equals: url,
            },
          },
        }
      )) as { results: unknown[] };
      return response.results.length > 0;
    } catch {
      return false;
    }
  }

  async getRecentUrls(days: number = 7): Promise<Set<string>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const urls = new Set<string>();

    try {
      const dataSourceId = await this.getDataSourceId();
      const response = (await this.request(
        `/data_sources/${dataSourceId}/query`,
        "POST",
        {
          filter: {
            property: "Collected At",
            date: {
              after: cutoff.toISOString(),
            },
          },
        }
      )) as { results: Array<{ properties?: Record<string, unknown> }> };

      for (const page of response.results) {
        if (page.properties) {
          const urlProp = page.properties["Original URL"] as
            | { url?: string }
            | undefined;
          if (urlProp && typeof urlProp.url === "string") {
            urls.add(urlProp.url);
          }
        }
      }
    } catch (error) {
      console.error("[notion] Error fetching recent URLs:", error);
    }

    return urls;
  }

  /**
   * 優先度がHighのアイデアを取得
   */
  async getHighPriorityIdeas(): Promise<Array<{
    id: string;
    title: string;
    idea: string;
    painPoint: string;
    category: string;
    originalUrl?: string;
  }>> {
    try {
      const dataSourceId = await this.getDataSourceId();
      const response = (await this.request(
        `/data_sources/${dataSourceId}/query`,
        "POST",
        {
          filter: {
            property: "Potential",
            select: {
              equals: "High",
            },
          },
        }
      )) as {
        results: Array<{
          id: string;
          properties?: Record<string, unknown>;
        }>;
      };

      const highPriorityIdeas: Array<{
        id: string;
        title: string;
        idea: string;
        painPoint: string;
        category: string;
        originalUrl?: string;
      }> = [];

      for (const page of response.results) {
        if (!page.properties) continue;

        const titleProp = page.properties.Title as
          | { title?: Array<{ plain_text?: string }> }
          | undefined;
        const ideaProp = page.properties.Idea as
          | { rich_text?: Array<{ plain_text?: string }> }
          | undefined;
        const painPointProp = page.properties["Pain Point"] as
          | { rich_text?: Array<{ plain_text?: string }> }
          | undefined;
        const categoryProp = page.properties.Category as
          | { select?: { name?: string } }
          | undefined;
        const urlProp = page.properties["Original URL"] as
          | { url?: string }
          | undefined;

        const title =
          titleProp?.title?.[0]?.plain_text || "Untitled";
        const idea =
          ideaProp?.rich_text?.[0]?.plain_text || "";
        const painPoint =
          painPointProp?.rich_text?.[0]?.plain_text || "";
        const category = categoryProp?.select?.name || "その他";
        const originalUrl = urlProp?.url;

        highPriorityIdeas.push({
          id: page.id,
          title,
          idea,
          painPoint,
          category,
          originalUrl,
        });
      }

      return highPriorityIdeas;
    } catch (error) {
      console.error("[notion] Error fetching high priority ideas:", error);
      return [];
    }
  }

  /**
   * TODOリストを作成してNotionに追加
   * @param todoDatabaseId TODOデータベースID（環境変数NOTION_TODO_DATABASE_IDまたは既存のデータベースID）
   * @param ideas 追加するアイデアのリスト
   */
  async createTodos(
    ideas: Array<{
      id: string;
      title: string;
      idea: string;
      painPoint: string;
      category: string;
      originalUrl?: string;
    }>,
    todoDatabaseId?: string
  ): Promise<string[]> {
    const targetDatabaseId = todoDatabaseId || process.env.NOTION_TODO_DATABASE_ID || this.databaseId;
    
    if (!targetDatabaseId) {
      console.warn("[notion] No TODO database ID specified, skipping TODO creation");
      return [];
    }

    const createdIds: string[] = [];

    try {
      // TODOデータベースのdata_source_idを取得
      const todoDatabase = (await this.request(
        `/databases/${targetDatabaseId}`,
        "GET"
      )) as { data_sources?: Array<{ id: string }> };

      const todoDataSourceId =
        todoDatabase.data_sources && todoDatabase.data_sources.length > 0
          ? todoDatabase.data_sources[0].id
          : targetDatabaseId;

      for (const idea of ideas) {
        try {
          // 既存のアイデアページへのリンクを作成
          const ideaPageUrl = `https://www.notion.so/${idea.id.replace(/-/g, "")}`;

          // TODOページのプロパティ
          const properties: Record<string, unknown> = {
            Name: {
              title: [
                {
                  text: {
                    content: idea.title,
                  },
                },
              ],
            },
          };

          // カテゴリプロパティがある場合
          if (idea.category) {
            properties.Category = {
              select: {
                name: idea.category,
              },
            };
          }

          // 元のアイデアページへのリンクプロパティがある場合
          if (idea.originalUrl) {
            properties["Original URL"] = {
              url: idea.originalUrl,
            };
          }

          // アイデアページへのリンクプロパティがある場合
          properties["Idea Page"] = {
            url: ideaPageUrl,
          };

          // 優先度プロパティ（High固定）
          properties.Priority = {
            select: {
              name: "High",
            },
          };

          // ステータスプロパティ（Not Started固定）
          properties.Status = {
            select: {
              name: "Not Started",
            },
          };

          // 作成日時プロパティ
          properties["Created At"] = {
            date: {
              start: new Date().toISOString(),
            },
          };

          // ページ本文に詳細を追加
          const children: unknown[] = [
            {
              object: "block",
              type: "heading_3",
              heading_3: {
                rich_text: [
                  { type: "text", text: { content: "課題・不満" } },
                ],
              },
            },
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  { type: "text", text: { content: idea.painPoint || "なし" } },
                ],
              },
            },
            {
              object: "block",
              type: "heading_3",
              heading_3: {
                rich_text: [
                  { type: "text", text: { content: "ビジネスアイデア" } },
                ],
              },
            },
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  { type: "text", text: { content: idea.idea || "なし" } },
                ],
              },
            },
          ];

          const page = await this.request("/pages", "POST", {
            parent: {
              type: "data_source_id",
              data_source_id: todoDataSourceId,
            },
            properties,
            children,
          });

          createdIds.push((page as { id: string }).id);
          console.log(`[notion] Created TODO: ${idea.title}`);
        } catch (error) {
          console.error(`[notion] Error creating TODO for ${idea.title}:`, error);
        }
      }
    } catch (error) {
      console.error("[notion] Error creating TODOs:", error);
    }

    return createdIds;
  }
}
