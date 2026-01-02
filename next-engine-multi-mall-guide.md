# ネクストエンジン マルチモール対応ガイド

## 概要

楽天、Amazon、Qoo10、Yahoo!ショッピングで既に運用中の店舗が、ネクストエンジンで商品マスタを一元管理する際の実践ガイドです。

---

## 1. 主要な課題と解決策まとめ

### 課題1: 商品コードがモールごとにバラバラ

**現状:**
```
同じ商品が...
- 楽天: rakuten-prod-001
- Amazon: B08XXXXX (ASIN) + seller-sku-001 (SKU)
- Qoo10: 12345678
- Yahoo: yahoo-prod-001
- 社内: MASTER-001
```

**解決策:**
✅ **統一マスターコード体系の導入**
- ネクストエンジンで `MASTER-001` を統一コードとして使用
- 各モールの商品コードをマッピングテーブルで紐付け
- JANコードがあれば必ず記録

**実装ファイル:**
```yaml
# product-mapping.yaml
master_products:
  - master_code: "MASTER-001"
    internal_sku: "SKU-TSHIRT-BLK-M"
    jan_code: "4901234567890"
    mall_mappings:
      rakuten:
        product_code: "rakuten-prod-001"
      amazon:
        asin: "B08XXXXX"
        seller_sku: "seller-sku-001"
      qoo10:
        product_number: "12345678"
      yahoo:
        product_id: "yahoo-prod-001"
```

---

### 課題2: モールごとに商品情報が違う

**現状:**
| 項目 | 楽天 | Amazon | Qoo10 | Yahoo |
|------|------|--------|-------|-------|
| 商品名 | 【送料無料】メンズTシャツ | メンズTシャツ ブラック M | Men's T-Shirt Black | メンズTシャツ（黒） |
| 価格 | 2,980円 | 2,780円 | 2,680円 | 2,880円 |
| 説明 | 楽天限定セット | Amazon簡潔版 | 韓国語混在 | Yahoo向け |

**解決策:**
✅ **モール別属性の一元管理**
- 共通属性（SKU、JANコード、基本価格、在庫）をマスター化
- モール固有の商品名・説明文・価格は別管理
- 必要に応じてモール別に出し分け

**CSVフォーマット例:**
```csv
master_code,internal_sku,jan_code,base_price,stock,rakuten_name,rakuten_price,amazon_title,amazon_price,qoo10_title,qoo10_price,yahoo_name,yahoo_price
MASTER-001,SKU-001,4901234567890,2800,100,"【送料無料】メンズTシャツ",2980,"メンズTシャツ ブラック M",2780,"Men's T-Shirt Black M",2680,"メンズTシャツ（黒・M）",2880
```

---

### 課題3: 在庫管理が複雑

**2つの選択肢:**

#### オプションA: モール別在庫管理
```yaml
inventory:
  mode: mall_specific
  allocation:
    master_code: "MASTER-001"
    total_stock: 100
    mall_allocation:
      rakuten: 30    # 楽天に30個割り当て
      amazon: 40     # Amazonに40個割り当て
      qoo10: 15
      yahoo: 15
    rules:
      auto_rebalance: true  # 売れ行きに応じて自動再配分
      safety_stock: 5       # 安全在庫
```

**メリット:**
- 各モールの売れ行きに応じた最適配分
- モール固有のキャンペーン対応が容易

**デメリット:**
- 管理が複雑
- 在庫バランスの調整が必要

#### オプションB: 統合在庫管理（推奨）
```yaml
inventory:
  mode: unified
  allocation:
    master_code: "MASTER-001"
    total_stock: 100
    rules:
      priority_order:        # 売れた順に引き当て
        - amazon             # 利益率が高いAmazon優先
        - rakuten
        - yahoo
        - qoo10
      buffer_stock: 10       # 安全在庫
      oversell_protection: true
      sync_interval_minutes: 5
```

**メリット:**
- シンプルな管理
- 在庫切れリスク低減
- 売り越し防止機能

**デメリット:**
- モール別在庫調整が難しい

---

### 課題4: データ移行のリスク

**推奨: 段階的移行（3フェーズ）**

```
Phase 1: パイロット（1週間）
  └─ 20商品で動作確認
  └─ 受注フロー、在庫同期をテスト

Phase 2: カテゴリ別（2週間）
  └─ 100-200商品を移行
  └─ 既存システムと並行稼働

Phase 3: 全商品（1ヶ月）
  └─ 全商品を移行
  └─ ネクストエンジンへ完全移行
```

**移行チェックリスト:**
- [ ] 既存モールからデータエクスポート（CSV）
- [ ] 商品コードマッピングテーブル作成
- [ ] データクレンジング（重複排除、整形）
- [ ] Dry Runでテスト実行
- [ ] パイロット商品で本番移行
- [ ] 受注・在庫同期の動作確認
- [ ] 段階的に全商品展開

---

## 2. モール固有の制約事項

### 楽天市場（RMS）

**制約:**
- 商品名: 最大255文字
- 説明文: 最大10,000文字
- カテゴリ階層: 最大4階層

**API制限:**
- レート制限: 5,000リクエスト/日
- 認証方式: ライセンスキー

**対応方法:**
```typescript
class RakutenValidator {
  validateProductName(name: string): boolean {
    return name.length <= 255;
  }

  validateDescription(desc: string): boolean {
    return desc.length <= 10000;
  }
}
```

---

### Amazon（セラーセントラル）

**制約:**
- ASIN必須（既存商品）
- SKU: 最大40文字
- プロダクトタイプ指定必須

**FBA対応:**
```yaml
amazon:
  fba_integration:
    enabled: true
    sync_fba_inventory: true
    fulfillment_center_id: "NRT1"  # 日本のFCコード
```

**API:**
- SP-API（Selling Partner API）使用
- OAuth 2.0認証
- マーケットプレイスID: `A1VC38T7YXB528`（日本）

---

### Qoo10

**制約:**
- 商品番号: 数値のみ
- 多言語対応: 日本語、韓国語、英語

**配送:**
```yaml
qoo10:
  shipping:
    qxpress_required: true      # Qxpress配送必須
    overseas_shipping: supported # 海外配送対応
```

**API:**
- エンドポイント: `https://api.qoo10.jp/GMKT.INC.Front.QAPIService/`
- 認証: APIキー

---

### Yahoo!ショッピング

**制約:**
- プロダクトID: 最大50文字
- カテゴリマッピング必須
- Yahoo!ウォレット連携必須

**PRO契約機能:**
- API連携
- 高度な分析機能

**API:**
- エンドポイント: `https://circus.shopping.yahooapis.jp/`
- 認証: Yahoo! ID

---

## 3. 実装の優先順位

### フェーズ1: 基盤構築（2週間）
1. **商品コードマッピングテーブル作成**
   - CSVまたはデータベース
   - マスターコード ↔ モール商品コード

2. **データローダー実装**
   - 楽天CSVローダー
   - AmazonCSVローダー
   - Qoo10CSVローダー
   - Yahoo CSVローダー

3. **バリデーション実装**
   - モール固有制約のチェック
   - データ整合性確認

### フェーズ2: 商品同期（2週間）
1. **商品データ統合処理**
   - モール別属性の統合
   - 共通属性の抽出

2. **Next Engine API連携**
   - 商品登録API
   - 商品更新API

3. **Dry Runモード実装**
   - テスト実行機能
   - ロールバック機能

### フェーズ3: 在庫管理（1週間）
1. **在庫配分ロジック**
   - モール別 or 統合
   - 優先順位設定

2. **在庫同期処理**
   - リアルタイム同期
   - バッチ同期

3. **安全在庫・アラート**
   - 在庫切れ防止
   - 通知機能

---

## 4. トラブルシューティング

### Q1. 商品コードが重複している
**A:** マッピングテーブルで一意性を確保。重複がある場合は以下で対処：
```typescript
// 重複検出
const duplicates = findDuplicateMasterCodes(mappingTable);

// 解決策1: サフィックス追加
// MASTER-001 → MASTER-001-A, MASTER-001-B

// 解決策2: モール別プレフィックス
// rakuten_MASTER-001, amazon_MASTER-001
```

### Q2. 在庫同期が遅延する
**A:** バッチサイズとAPI制限を確認：
```yaml
inventory:
  sync:
    batch_size: 50              # 一度に処理する商品数
    concurrent_requests: 3      # 並列リクエスト数
    retry_on_failure: true
```

### Q3. モール別価格をどう管理するか
**A:** モール固有属性として管理：
```csv
master_code,base_price,rakuten_price,amazon_price,qoo10_price,yahoo_price
MASTER-001,2800,2980,2780,2680,2880
```

### Q4. 移行中に受注が入ったらどうするか
**A:** 段階的移行中は両システムで受注可能に：
- ネクストエンジン: 新規受注
- 既存モールシステム: 移行済み商品以外の受注
- 定期的に在庫を双方向同期

---

## 5. 成功のポイント

### ✅ 商品コード統一を最優先
マッピングテーブルなしでは何も始まらない

### ✅ 段階的移行でリスク最小化
一度に全商品は移行しない

### ✅ Dry Runを活用
本番前に必ずテスト実行

### ✅ モール固有制約を理解
各モールのAPI制限、データ形式を把握

### ✅ 在庫管理方針を明確化
モール別 vs 統合を早期に決定

---

## 6. 参考データフロー図

```
┌─────────────┐
│ 楽天 RMS    │──┐
└─────────────┘  │
                 │
┌─────────────┐  │    ┌──────────────┐    ┌──────────────────┐
│ Amazon SC   │──┼───→│ データ抽出   │───→│ データクレンジング│
└─────────────┘  │    └──────────────┘    └──────────────────┘
                 │                                    │
┌─────────────┐  │                                    ↓
│ Qoo10       │──┤                        ┌──────────────────┐
└─────────────┘  │                        │ 商品コード統一   │
                 │                        └──────────────────┘
┌─────────────┐  │                                    │
│ Yahoo!      │──┘                                    ↓
└─────────────┘                          ┌──────────────────┐
                                         │ マッピングテーブル│
                                         └──────────────────┘
                                                    │
                                                    ↓
                              ┌────────────────────────────────┐
                              │ ネクストエンジン商品マスター    │
                              │  - master_code                 │
                              │  - 共通属性                    │
                              │  - モール別属性                │
                              └────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ↓                    ↓                    ↓
              ┌──────────┐        ┌──────────┐        ┌──────────┐
              │ 在庫同期 │        │ 受注取込 │        │ 発送連携 │
              └──────────┘        └──────────┘        └──────────┘
```

---

## 7. 次のステップ

1. **現状把握**
   - [ ] 各モールの商品数を確認
   - [ ] 商品コード体系を整理
   - [ ] 在庫管理方式を決定

2. **マッピングテーブル作成**
   - [ ] CSVテンプレート準備
   - [ ] 既存商品データをエクスポート
   - [ ] マスターコードを付番

3. **パイロット実施**
   - [ ] 20商品を選定
   - [ ] テスト移行実行
   - [ ] 動作検証

4. **本番展開**
   - [ ] フェーズ2: カテゴリ別移行
   - [ ] フェーズ3: 全商品移行
   - [ ] 運用開始

---

**作成日**: 2026-01-02
**対象モール**: 楽天、Amazon、Qoo10、Yahoo!ショッピング
**バージョン**: 1.0.0
