# AFTERTOUCH — Interactive WebGL + Jev

触れる速度と軌跡に応じて、粒子の流れと光が変化するThree.js作品です。Node.jsプロキシがTypeSafe Jevへ集約したジェスチャー指標を送り、型付きChoice結果を返します。APIキーを設定していない状態でも、ローカル判定で作品を操作できます。

`gamaccho/granular-flow` の `experiments/aftertouch` に保存したテスト実装です。[GitHub Pagesの公開テスト](https://gamaccho.github.io/granular-flow/aftertouch001/)はローカル判定で動作します。Jevプロキシの公開ホスティングとギャラリー掲載はまだ設定していません。リポジトリのルートから使う場合は、先に `cd experiments/aftertouch` でこのフォルダーへ移動してください。

## GitHub Pagesの公開テスト

公開先：**https://gamaccho.github.io/granular-flow/aftertouch001/**

画面には「01 / PREVIEW」「公開テスト · ローカル判定（Jevなし）」と表示します。動きに応じた描画と分類はブラウザー内で行い、APIリクエストは送りません。サーバーやAPIキーを公開ファイルに含めません。

```sh
npm ci
npm run build:pages
```

生成された `dist` の内容をリポジトリの `aftertouch001/` に配置し、mainへ反映するとPagesで配信されます。アセットは相対URLなので、リポジトリのサブディレクトリから読み込めます。通常の `npm run dev` / `npm run build` では、従来どおりプロキシへ接続します。

配信したビルドのブラウザーテストは、ローカルの静的HTTPサーバーまたは公開先を指定して実行できます。

```sh
AFTERTOUCH_PREVIEW_URL=https://gamaccho.github.io/granular-flow/aftertouch001/ npm run test:browser -- --grep 'static Pages preview'
```

モバイル表示の自動検証はChromeの端末エミュレーションです。iPhone実機のSafariでの速度・表示は別途確認してください。

## 起動

Node.js **22.12以上**とnpmを使用してください。

```sh
npm ci
cp .env.example .env
npm run dev
```

ブラウザーで **http://localhost:5173** を開きます。プロキシは3000番、Viteは5173番を使用します。導入済みの作業フォルダーでは `npm run dev` だけでキーなしの作品を起動できます。

Jevを使う場合は `.env` の `TYPESAFE_API_KEY` に、ご自身のキーをエディターで設定し、プロキシを再起動してください。`your_key_here` は未設定として扱います。キーをチャットやクライアントソースへ貼る必要はありません。接続状態は画面左下に表示されます。

スマートフォンから同じLAN上で試す場合は、Viteが表示するNetwork URLを開いてください。APIはVite経由でプロキシへ送られます。開発サーバーをインターネットへ公開する設定は含みません。

## 操作

- マウスを動かす、または画面を指でなぞると、光の流れが反応します。
- ゆっくり滑らかに動かす：`tender`／琥珀色／引き寄せ。
- しばらく止める、ためらう動き：`hesitant`／淡い青／反発。
- 素早く往復する：`aggressive`／紅色／放射状のバースト。
- 曲線や変化のある軌跡：`playful`／紫／周回。
- 右下に停止・再開、リセット、全画面ボタンがあります。キーボードではSpace、R、Fを使えます。全画面はブラウザーが対応している場合に利用できます。

これらの語は作品のための動きの分類です。実際の心理状態を確定する情報として扱いません。

## 本番用サーバー

```sh
npm run build
npm start
```

**http://localhost:3000** で、Expressが `dist` と `/api` を同じオリジンから配信します。静的ファイルだけをホスティングすると、別途プロキシがない限りローカル判定になります。スマートフォンに公開する環境ではHTTPSを使用します。

環境変数：

| 変数 | 内容 |
| --- | --- |
| `TYPESAFE_API_KEY` | サーバーのみで使用するTypeSafe APIキー |
| `PORT` | プロキシのポート。既定3000 |
| `JEV_MODEL` | 既定 `jev-latest` |
| `JEV_MOCK` | `true` の場合だけ明示的モック。上流へ通信しません |
| `ALLOWED_ORIGINS` | 分離ホスティング時の許可オリジン。カンマ区切り |
| `TRUST_PROXY` | 既定 `false`。信頼できるリバースプロキシの後ろでのみ、構成に合うホップ数・IP範囲を指定 |

`JEV_MOCK=true npm run dev` でキーを使わず接続経路を試せます。画面にはMOCKと表示します。Jevとして表示するのは実際に検証済みの上流応答が返った場合だけです。

IP制限は**単一Node.jsプロセスのメモリー**で管理し、再起動でリセットされます。複数インスタンスで公開する場合は、同等の制限を共有ストアまたはエッジ側へ移してください。公開先へのデプロイはこの実装には含めていません。

## 構成

```text
index.html                    Viteエントリー
public/                       静的アセット用
src/main.js                   入力、UI、補間、表示ループ
src/input/gestureTracker.js   600msの指標集計
src/client/jevClient.js       タイムアウト、予算制御、フォールバック
src/render/particleFlow.js    Three.js GPUシミュレーション、残光、表示
src/shaders/                  GLSL ES 3.0 RawShaderMaterial
shared/mood.js                4モード、ローカル判定、補間
server/app.js                 テスト可能なExpressプロキシ
server/index.js               環境設定、起動、終了処理
tests/                        単体・HTTP・ブラウザーテスト
spec_interactive_webgl_jev.md 提供された仕様書のコピー
```

Vite標準の配置に合わせ、仕様の `public/index.html` はルートの `index.html` に置いています。Three.js r180、Tailwind、Expressを使用し、依存の正確な版は `package-lock.json` に固定しています。生成画像や外部CDNは使いません。

## API・時間制御

仕様の `/v1/inference`、`prompt`、`task`、`options` サンプルは現在の公式契約と異なるため、[TypeSafe公式API](https://docs.typesafe.ai/api)に合わせ、**POST `https://api.typesafe.ai/v1/systemone`** へ `model`、`state`、`questions.mood` を送ります。`answers.mood.choice` と `confidence` を検証し、画面向けの小さな応答へ正規化します。

フロントから **POST `/api/infer-mood`** に送るJSONは、次の7項目だけです。生の座標列や自由入力、APIキーは送りません。

| 項目 | 意味・単位 |
| --- | --- |
| `speed` | 平均速度。CSS px/ms |
| `jitter` | 符号付き旋回角の標準偏差。rad |
| `dwellRatio` | 0.04 CSS px/ms未満だった時間の比率。0〜1 |
| `strokeLength` | 600ms窓内の移動距離。CSS px |
| `curvature` | 絶対旋回角の平均。rad |
| `duration` | 集計した時間。ms、最大600 |
| `sampleCount` | 集計したサンプル数 |

```json
{
  "speed": 0.2,
  "jitter": 0.05,
  "dwellRatio": 0.1,
  "strokeLength": 120,
  "curvature": 0.08,
  "duration": 600,
  "sampleCount": 20
}
```

応答例：

```json
{ "choice": "tender", "confidence": 0.88, "source": "jev", "latencyMs": 95, "model": "jev-latest" }
```

`source` は `jev`、`heuristic`、`mock` のいずれかです。キーなし、失敗、上流異常、遅延時は `reason` 付きの `heuristic` 応答になります。入力エラーは400、JSON以外は415、4KB超は413、IP制限は429です。429には `Retry-After` を付けます。`GET /api/health` は秘密情報を返さず、設定上の接続種別を返します。healthの `jev` はキーが設定済みという意味で、実接続成功の証拠ではありません。

上流の401・403は `reason: "upstream_auth"` として区別し、画面にもキーの認証失敗を表示します。失敗応答に上流HTTPステータスや許可した通信エラーコードを付ける場合がありますが、上流のエラー本文・キー・例外の詳細は返しません。

- クライアントの判定トリガーは最低800ms間隔です。実際の上流呼び出しは**最低2100ms間隔**にし、30回／分以内を継続できるようにします。途中もローカル判定・描画は続きます。
- プロキシはIP別の**直近60秒で最大30回**を制限します。既定で偽装された `X-Forwarded-For` を信頼しません。
- 上流の読み込み・JSON処理を含めて270msで中断し、ブラウザーは300msでローカル判定に戻ります。同時リクエストや無制限再試行をしません。
- 60fpsの描画ループは推論を待たず、ポインターの物理作用は各フレームで反映します。ターゲット値は `current += (target - current) * min(1, deltaTime * 2.5)` で補間します。
- API推論の100ms未満、実機の60fpsは保証していません。通信環境やGPU性能に依存します。

## 描画・検証

位置・速度は浮動小数点テクスチャのping-pong更新、粒子の表示と残光もGPUで処理します。PCは65,536粒子、タッチ端末は36,864粒子です。描画ピクセル数とDPRを制限し、継続的にフレームが遅い場合は解像度を下げます。非表示タブでは描画・推論を止めます。WebGL 2、`EXT_color_buffer_float` が必要です。非対応端末では理由を画面に表示します。

`?debug=1` で、fps、粒子数、接続種別、描画解像度を表示します。停止・復帰、コンテキスト喪失時の表示、リサイズにも対応しています。

```sh
npm test
npm run build
npm run test:browser
```

ブラウザーテストにはインストール済みのGoogle Chromeを使用します。Chromeがない環境では `playwright.config.js` の `channel` を変更し、対応するPlaywrightブラウザーを導入してください。テスト用SwiftShaderは描画・操作の検証用途で、端末GPUの速度測定には使えません。実APIテストとスマートフォン実機テストは別途必要です。

初期実装時の確認：ビルド成功、入力・クライアント9件、実HTTPプロキシ14件、PC／モバイル表示6件、実際のVite→プロキシ接続1件が成功しました。画面キャプチャでPCとモバイルの配置も確認しています。

2026-10-01に実キーを設定したローカルプロキシを経由し、Jev実APIから `choice: "tender"`、`confidence: 0.66`、`source: "jev"` の応答を確認しました。成功時のプロキシ処理時間は166msでした。初回は270msの期限を超えてローカル判定に戻っています。この単発の成功は通信速度の保証や判定品質の評価ではありません。APIキーと `.env` はリポジトリに含めていません。

認証エラー表示を追加した後のローカル確認では、ビルドと入力・クライアント9件は成功しています。HTTPテスト14件の再実行は、作業環境のポート待受制限により実行できませんでした。このフォルダーの変更時はGitHub Actionsの **AFTERTOUCH checks** が、実キーを使わず `npm ci`、`npm test`、`npm run build` を実行します。スマートフォン実機の速度と判定品質は未検証です。
