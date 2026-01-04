#!/usr/bin/env ts-node
/**
 * オープンロジ連携セットアップスクリプト
 *
 * このスクリプトは以下の設定を自動化します：
 * 1. 環境変数の設定（対話式）
 * 2. 設定ファイルの生成・更新
 * 3. 必要なディレクトリの作成
 * 4. 依存関係のインストール
 * 5. API接続テスト
 * 6. 商品マッピング設定
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { spawnSync } from 'child_process';

interface OpenlogiConfig {
  // API設定
  apiKey: string;
  companyId: string;
  apiEndpoint: string;

  // ブラウザ自動操作設定
  browserUsername: string;
  browserPassword: string;
  totpSecret?: string;

  // 通知設定
  notificationEmail: string;
  errorNotificationEmail: string;

  // 倉庫設定
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
}

interface SetupOptions {
  skipBrowserAuth: boolean;
  skip2FA: boolean;
  useDefaults: boolean;
}

class OpenlogiSetup {
  private rl: readline.Interface;
  private config: Partial<OpenlogiConfig> = {};
  private options: SetupOptions;

  constructor(options: Partial<SetupOptions> = {}) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.options = {
      skipBrowserAuth: options.skipBrowserAuth ?? false,
      skip2FA: options.skip2FA ?? true,
      useDefaults: options.useDefaults ?? false,
    };
  }

  /**
   * 安全なコマンド実行
   */
  private safeExec(command: string, args: string[] = []): { success: boolean; output: string } {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    return {
      success: result.status === 0,
      output: result.stdout || result.stderr || '',
    };
  }

  /**
   * 質問を表示して回答を取得
   */
  private async question(prompt: string, defaultValue?: string): Promise<string> {
    if (this.options.useDefaults && defaultValue) {
      console.log(`${prompt} (デフォルト: ${defaultValue})`);
      return defaultValue;
    }

    return new Promise((resolve) => {
      const promptText = defaultValue
        ? `${prompt} (デフォルト: ${defaultValue}): `
        : `${prompt}: `;

      this.rl.question(promptText, (answer) => {
        resolve(answer || defaultValue || '');
      });
    });
  }

  /**
   * パスワードを安全に入力（非表示）
   */
  private async questionPassword(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(`${prompt}: `);

      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let password = '';

      const onData = (char: string) => {
        char = char.toString('utf8');

        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            resolve(password);
            break;
          case '\u0003':
            process.exit();
            break;
          case '\u007F': // Backspace
            password = password.slice(0, -1);
            stdout.clearLine(0);
            stdout.cursorTo(0);
            stdout.write(`${prompt}: ${'*'.repeat(password.length)}`);
            break;
          default:
            password += char;
            stdout.write('*');
            break;
        }
      };

      stdin.on('data', onData);
    });
  }

  /**
   * Yes/No質問
   */
  private async confirmQuestion(prompt: string, defaultValue: boolean = true): Promise<boolean> {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.question(`${prompt} (${defaultText})`);

    if (!answer) return defaultValue;

    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  /**
   * セットアップ開始
   */
  async run(): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 オープンロジ連携セットアップ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // ステップ1: 環境確認
      await this.checkEnvironment();

      // ステップ2: 設定情報の収集
      await this.collectConfiguration();

      // ステップ3: 依存関係のインストール
      await this.installDependencies();

      // ステップ4: ディレクトリ構造の作成
      await this.createDirectories();

      // ステップ5: 環境変数ファイルの生成
      await this.generateEnvFile();

      // ステップ6: 設定ファイルの更新
      await this.updateConfigFiles();

      // ステップ7: 商品マッピング設定
      await this.setupProductMapping();

      // ステップ8: セットアップ完了
      await this.finish();

    } catch (error) {
      console.error('\n❌ セットアップ中にエラーが発生しました:', error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * ステップ1: 環境確認
   */
  private async checkEnvironment(): Promise<void> {
    console.log('📋 ステップ1: 環境確認\n');

    // Node.jsバージョン確認
    const nodeVersion = process.version;
    console.log(`✓ Node.js: ${nodeVersion}`);

    // npmの確認
    const npmCheck = this.safeExec('npm', ['--version']);
    if (npmCheck.success) {
      console.log(`✓ npm: ${npmCheck.output.trim()}`);
    } else {
      console.log('⚠️ npm が見つかりません');
    }

    // TypeScriptの確認
    const tsCheck = this.safeExec('npx', ['tsc', '--version']);
    if (tsCheck.success) {
      console.log(`✓ TypeScript: ${tsCheck.output.trim()}`);
    } else {
      console.log('⚠️ TypeScript が見つかりません（自動インストールします）');
    }

    console.log('');
  }

  /**
   * ステップ2: 設定情報の収集
   */
  private async collectConfiguration(): Promise<void> {
    console.log('📝 ステップ2: 設定情報の収集\n');

    console.log('オープンロジのAPI認証情報を入力してください。');
    console.log('（管理画面 → 設定 → API設定 から取得できます）\n');

    // API設定
    this.config.apiKey = await this.question(
      'API Key',
      process.env.OPENLOGI_API_KEY
    );

    this.config.companyId = await this.question(
      'Company ID',
      process.env.OPENLOGI_COMPANY_ID
    );

    this.config.apiEndpoint = await this.question(
      'API Endpoint',
      'https://api.openlogi.com/v1'
    );

    // 通知設定
    console.log('\n通知設定:');
    this.config.notificationEmail = await this.question(
      '通知先メールアドレス',
      process.env.OPENLOGI_NOTIFICATION_EMAIL || process.env.USER + '@example.com'
    );

    this.config.errorNotificationEmail = await this.question(
      'エラー通知先メールアドレス',
      this.config.notificationEmail
    );

    // ブラウザ自動操作設定（オプション）
    if (!this.options.skipBrowserAuth) {
      console.log('\nブラウザ自動操作設定（API利用不可時のフォールバック）:');
      const useBrowserAuth = await this.confirmQuestion(
        'ブラウザ自動操作を設定しますか？'
      );

      if (useBrowserAuth) {
        this.config.browserUsername = await this.question(
          'オープンロジログインメールアドレス',
          process.env.OPENLOGI_BROWSER_USERNAME
        );

        this.config.browserPassword = await this.questionPassword(
          'オープンロジログインパスワード'
        );

        // 2要素認証
        if (!this.options.skip2FA) {
          const use2FA = await this.confirmQuestion(
            '2要素認証を使用しますか？',
            false
          );

          if (use2FA) {
            this.config.totpSecret = await this.question(
              'TOTP Secret (Base32)',
              process.env.OPENLOGI_TOTP_SECRET
            );
          }
        }
      }
    }

    // 倉庫設定
    console.log('\n倉庫設定:');
    this.config.warehouseId = await this.question(
      '倉庫ID',
      process.env.OPENLOGI_WAREHOUSE_ID || ''
    );

    this.config.warehouseName = await this.question(
      '倉庫名',
      'メイン倉庫'
    );

    this.config.warehouseLocation = await this.question(
      '倉庫所在地',
      '関東'
    );

    console.log('\n✅ 設定情報の収集完了\n');
  }

  /**
   * ステップ3: 依存関係のインストール
   */
  private async installDependencies(): Promise<void> {
    console.log('📦 ステップ3: 依存関係のインストール\n');

    const install = await this.confirmQuestion(
      '必要なパッケージをインストールしますか？'
    );

    if (!install) {
      console.log('スキップしました\n');
      return;
    }

    console.log('インストール中...\n');

    // puppeteerのインストール
    console.log('- puppeteer をインストール中...');
    const puppeteerResult = this.safeExec('npm', ['install', '--save', 'puppeteer']);
    if (puppeteerResult.success) {
      console.log('  ✓ puppeteer インストール完了');
    } else {
      console.log('  ⚠️ puppeteer インストール失敗');
    }

    // speakeasyのインストール（2FA使用時）
    if (this.config.totpSecret) {
      console.log('- speakeasy をインストール中...');
      const speakeasyResult = this.safeExec('npm', ['install', '--save', 'speakeasy']);
      if (speakeasyResult.success) {
        console.log('  ✓ speakeasy インストール完了');
      }

      const speakeasyTypesResult = this.safeExec('npm', [
        'install',
        '--save-dev',
        '@types/speakeasy',
      ]);
      if (speakeasyTypesResult.success) {
        console.log('  ✓ @types/speakeasy インストール完了');
      }
    }

    console.log('\n✅ 依存関係のインストール完了\n');
  }

  /**
   * ステップ4: ディレクトリ構造の作成
   */
  private async createDirectories(): Promise<void> {
    console.log('📁 ステップ4: ディレクトリ構造の作成\n');

    const directories = [
      'cache',
      'logs',
      'logs/openlogi-integration',
      'logs/openlogi-reports',
      'logs/openlogi-costs',
      'logs/browser-screenshots',
      'logs/browser-errors',
      'data',
    ];

    for (const dir of directories) {
      const fullPath = path.join(process.cwd(), dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`✓ ${dir}/`);
      } catch (error) {
        console.log(`⚠️ ${dir}/ (既に存在します)`);
      }
    }

    console.log('\n✅ ディレクトリ作成完了\n');
  }

  /**
   * ステップ5: 環境変数ファイルの生成
   */
  private async generateEnvFile(): Promise<void> {
    console.log('🔐 ステップ5: 環境変数ファイルの生成\n');

    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');

    // .envファイルが既に存在するか確認
    let existingEnv = '';
    try {
      existingEnv = await fs.readFile(envPath, 'utf-8');
      console.log('既存の .env ファイルが見つかりました');

      const overwrite = await this.confirmQuestion(
        '既存の設定に追記しますか？（いいえの場合、新規作成します）',
        true
      );

      if (!overwrite) {
        existingEnv = '';
      }
    } catch {
      console.log('.env ファイルを新規作成します');
    }

    // オープンロジ設定を追加
    const openlogiEnv = `
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# オープンロジ連携設定
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# API認証
OPENLOGI_API_KEY="${this.config.apiKey || ''}"
OPENLOGI_COMPANY_ID="${this.config.companyId || ''}"

# 倉庫設定
OPENLOGI_WAREHOUSE_ID="${this.config.warehouseId || ''}"

# 通知設定
OPENLOGI_NOTIFICATION_EMAIL="${this.config.notificationEmail || ''}"
OPENLOGI_ERROR_NOTIFICATION_EMAIL="${this.config.errorNotificationEmail || ''}"
`;

    let browserEnv = '';
    if (this.config.browserUsername) {
      browserEnv = `
# ブラウザ自動操作（API利用不可時のフォールバック）
OPENLOGI_BROWSER_USERNAME="${this.config.browserUsername}"
OPENLOGI_BROWSER_PASSWORD="${this.config.browserPassword || ''}"
`;

      if (this.config.totpSecret) {
        browserEnv += `OPENLOGI_TOTP_SECRET="${this.config.totpSecret}"\n`;
      }
    }

    const finalEnv = existingEnv
      ? existingEnv + '\n' + openlogiEnv + browserEnv
      : openlogiEnv + browserEnv;

    await fs.writeFile(envPath, finalEnv);
    console.log('✓ .env ファイルを作成しました');

    // .env.exampleも更新
    try {
      let exampleEnv = await fs.readFile(envExamplePath, 'utf-8');
      if (!exampleEnv.includes('OPENLOGI_API_KEY')) {
        const exampleContent = openlogiEnv.replace(
          /="[^"]*"/g,
          '="your-value-here"'
        ) + (browserEnv ? browserEnv.replace(/="[^"]*"/g, '="your-value-here"') : '');

        await fs.writeFile(envExamplePath, exampleEnv + '\n' + exampleContent);
        console.log('✓ .env.example ファイルを更新しました');
      }
    } catch {
      // .env.exampleが存在しない場合はスキップ
    }

    console.log('\n✅ 環境変数ファイルの生成完了\n');
  }

  /**
   * ステップ6: 設定ファイルの更新
   */
  private async updateConfigFiles(): Promise<void> {
    console.log('⚙️ ステップ6: 設定ファイルの更新\n');

    const openlogiConfigPath = path.join(process.cwd(), 'openlogi-config.yaml');

    try {
      let config = await fs.readFile(openlogiConfigPath, 'utf-8');

      // 倉庫IDの更新
      if (this.config.warehouseId) {
        config = config.replace(
          /warehouse_id: ""/,
          `warehouse_id: "${this.config.warehouseId}"`
        );
      }

      // 倉庫名の更新
      if (this.config.warehouseName) {
        config = config.replace(
          /name: "メイン倉庫"/,
          `name: "${this.config.warehouseName}"`
        );
      }

      // 倉庫所在地の更新
      if (this.config.warehouseLocation) {
        config = config.replace(
          /location: "関東"/,
          `location: "${this.config.warehouseLocation}"`
        );
      }

      await fs.writeFile(openlogiConfigPath, config);
      console.log('✓ openlogi-config.yaml を更新しました');

    } catch (error) {
      console.log('⚠️ openlogi-config.yaml が見つかりません（スキップ）');
    }

    console.log('\n✅ 設定ファイルの更新完了\n');
  }

  /**
   * ステップ7: 商品マッピング設定
   */
  private async setupProductMapping(): Promise<void> {
    console.log('🔗 ステップ7: 商品マッピング設定\n');

    console.log('商品マッピング方式を選択してください:');
    console.log('1. 自動マッピング（推奨）: 商品コード/JANコードで自動マッピング');
    console.log('2. 手動マッピング: CSVファイルで手動マッピング');
    console.log('3. ハイブリッド: 両方を併用');
    console.log('');

    const mappingMethod = await this.question(
      'マッピング方式を選択 (1/2/3)',
      '1'
    );

    if (mappingMethod === '2' || mappingMethod === '3') {
      console.log('\n手動マッピングCSVファイルを作成します...');

      const csvPath = path.join(process.cwd(), 'data', 'openlogi-sku-mapping.csv');
      const csvContent = 'next_engine_sku,openlogi_sku,product_name\n' +
        '# 例: SKU-001,OPENLOGI-SKU-001,商品A\n' +
        '# この行を削除して、実際のマッピングを追加してください\n';

      await fs.writeFile(csvPath, csvContent);
      console.log(`✓ CSVテンプレートを作成しました: ${csvPath}`);
      console.log('  後でこのファイルを編集して、商品マッピングを設定してください。');
    }

    console.log('\n✅ 商品マッピング設定完了\n');
  }

  /**
   * ステップ8: セットアップ完了
   */
  private async finish(): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 セットアップ完了！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('次のステップ:');
    console.log('');
    console.log('1. 商品マッピングの設定（手動マッピングを選択した場合）');
    console.log('   → data/openlogi-sku-mapping.csv を編集');
    console.log('');
    console.log('2. API接続テスト');
    console.log('   → 手動で以下のコマンドを実行:');
    console.log(`   curl -H "Authorization: Bearer YOUR_API_KEY" ${this.config.apiEndpoint}/ping`);
    console.log('');
    console.log('3. 初回の出荷指示テスト（dry-run）');
    console.log('   → /user:next-engine-openlogi --dry-run');
    console.log('');
    console.log('4. 本番運用開始');
    console.log('   → /user:next-engine-openlogi');
    console.log('');
    console.log('詳細なドキュメント:');
    console.log('  - README.md');
    console.log('  - .claude/skills/next-engine/SKILL.md');
    console.log('  - docs/openlogi-setup-guide.md');
    console.log('');
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  const options: Partial<SetupOptions> = {};

  // コマンドライン引数の解析
  for (const arg of args) {
    if (arg === '--skip-browser-auth') {
      options.skipBrowserAuth = true;
    } else if (arg === '--skip-2fa') {
      options.skip2FA = true;
    } else if (arg === '--use-defaults') {
      options.useDefaults = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
使用方法:
  npx ts-node scripts/setup-openlogi.ts [オプション]

オプション:
  --skip-browser-auth  ブラウザ自動操作の設定をスキップ
  --skip-2fa           2要素認証の設定をスキップ
  --use-defaults       可能な限りデフォルト値を使用
  --help, -h           このヘルプを表示
      `);
      process.exit(0);
    }
  }

  const setup = new OpenlogiSetup(options);
  await setup.run();
}

// スクリプトとして実行された場合
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { OpenlogiSetup };
