import OpenAI from "openai";
import type { BusinessIdea, CollectedItem, Config } from "./types.js";

// エラータイプの定義
interface OpenAIError extends Error {
  status?: number;
  code?: string;
  type?: string;
}

// リトライ設定
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};

const ANALYSIS_PROMPT = `あなたはビジネスアイデア発掘の専門家です。
以下のSNS/メディアから収集したコンテンツを分析し、ビジネスアイデアの種を抽出してください。

**重要**: 入力データが英語であっても、出力は必ず日本語で記述してください。

## 分析観点
1. **課題・不満**: ユーザーが感じている課題や不満は何か
2. **ニーズ**: 潜在的なニーズや「欲しい」という欲求
3. **市場機会**: ビジネスとして成立しそうな機会
4. **実現可能性**: 技術的・ビジネス的な実現可能性

## 出力形式
各アイテムについて、ビジネスアイデアとして価値があるものだけをJSON形式で出力してください。
価値がないと判断したものは除外してください。
**全ての出力フィールド（title, painPoint, idea, potentialReason）は日本語で記述すること。**

\`\`\`json
[
  {
    "title": "アイデアのタイトル（20文字以内）",
    "category": "カテゴリ（SaaS/EC/マーケットプレイス/コミュニティ/ツール/コンテンツ/その他）",
    "painPoint": "発見した課題・不満（100文字以内）",
    "idea": "ビジネスアイデアの概要（200文字以内）",
    "potential": "High/Medium/Low",
    "potentialReason": "ポテンシャル判定の理由（50文字以内）",
    "sourceIndex": 元データのインデックス番号
  }
]
\`\`\`

ポテンシャルの判定基準:
- High: 明確な課題、複数人が共感、市場規模が見込める
- Medium: 課題は明確だが市場規模が不明、または競合多数
- Low: 一部のニッチ層のみ、実現困難、または既に解決済み

## 分析対象データ
`;

export class IdeaAnalyzer {
  private client: OpenAI;
  private config: Config;
  private quotaExhausted = false;

  constructor(config: Config) {
    this.config = config;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not set");
    }

    this.client = new OpenAI({ apiKey });
  }

  async analyze(items: CollectedItem[]): Promise<BusinessIdea[]> {
    if (items.length === 0) {
      return [];
    }

    // バッチ処理（一度に20件まで）
    const batchSize = 20;
    const allIdeas: BusinessIdea[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      // クォータ超過時は残りのバッチをスキップ
      if (this.quotaExhausted) {
        console.warn(
          `[analyzer] Skipping remaining ${Math.ceil((items.length - i) / batchSize)} batches due to quota exhaustion`
        );
        break;
      }

      const batch = items.slice(i, i + batchSize);
      const ideas = await this.analyzeBatch(batch, i);
      allIdeas.push(...ideas);
    }

    return allIdeas;
  }

  /**
   * 指数バックオフでスリープ
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * リトライ可能なエラーかどうかを判定
   */
  private isRetryableError(error: OpenAIError): boolean {
    // 429 Rate Limit（一時的なレート制限）はリトライ可能
    // ただし insufficient_quota（クォータ超過）はリトライ不可
    if (error.status === 429) {
      return error.code !== "insufficient_quota";
    }
    // 500系エラーはリトライ可能
    if (error.status && error.status >= 500) {
      return true;
    }
    return false;
  }

  /**
   * クォータ超過エラーかどうかを判定
   */
  private isQuotaExhaustedError(error: OpenAIError): boolean {
    return error.code === "insufficient_quota" || error.type === "insufficient_quota";
  }

  private async analyzeBatch(
    items: CollectedItem[],
    startIndex: number
  ): Promise<BusinessIdea[]> {
    // データを整形
    let itemsText = "";
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      itemsText += `
---
Index: ${startIndex + idx}
Source: ${item.source}
Title: ${item.title}
Content: ${item.content.slice(0, 500)}
Engagement: ${item.engagement}
URL: ${item.url}
`;
    }

    let prompt = ANALYSIS_PROMPT + itemsText;

    if (this.config.analysis.japanFocus) {
      prompt += "\n\n注意: 日本市場でのビジネス機会を重視して分析してください。";
    }

    // リトライロジック付きでAPI呼び出し
    let lastError: OpenAIError | null = null;

    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.analysis.model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });

        // JSONを抽出
        const content = response.choices[0]?.message?.content;
        if (!content) {
          return [];
        }

        const text = content;

        // ```json ... ``` を抽出
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text;

        const ideas: BusinessIdea[] = JSON.parse(jsonStr);

        // 元データの情報を付加
        for (const idea of ideas) {
          const sourceIdx = idea.sourceIndex ?? 0;
          const itemIdx = sourceIdx - startIndex;
          if (itemIdx >= 0 && itemIdx < items.length) {
            const original = items[itemIdx];
            idea.originalUrl = original.url;
            idea.originalSource = original.source;
            idea.collectedAt = original.collectedAt.toISOString();
          }
        }

        return ideas;
      } catch (error) {
        const openAIError = error as OpenAIError;
        lastError = openAIError;

        // クォータ超過エラーの場合はリトライせずに終了
        if (this.isQuotaExhaustedError(openAIError)) {
          this.quotaExhausted = true;
          console.error(
            "[analyzer] ⚠️ OpenAI API quota exceeded. Please check your billing at https://platform.openai.com/account/billing"
          );
          console.error(
            "[analyzer] Analysis will be skipped for remaining items."
          );
          return [];
        }

        // リトライ可能なエラーの場合
        if (this.isRetryableError(openAIError)) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelayMs
          );
          console.warn(
            `[analyzer] Rate limited (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}). Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        // JSON パースエラーの場合
        if (error instanceof SyntaxError) {
          console.error("[analyzer] JSON parse error:", error.message);
          return [];
        }

        // その他のエラー
        console.error("[analyzer] API error:", openAIError.message || error);
        return [];
      }
    }

    // リトライ回数超過
    console.error(
      `[analyzer] Max retries (${RETRY_CONFIG.maxRetries}) exceeded. Last error:`,
      lastError?.message
    );
    return [];
  }
}
