import OpenAI from "openai";
import type { BusinessIdea, CollectedItem, Config } from "./types.js";

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
      const batch = items.slice(i, i + batchSize);
      const ideas = await this.analyzeBatch(batch, i);
      allIdeas.push(...ideas);
    }

    return allIdeas;
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
      if (error instanceof SyntaxError) {
        console.error("[analyzer] JSON parse error:", error);
      } else {
        console.error("[analyzer] Analysis error:", error);
      }
      return [];
    }
  }
}
