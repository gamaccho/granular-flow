# AFTERTOUCH — Interactive WebGL + Jev

触れる速度と軌跡に応じて、粒子の流れと光が変化するThree.js作品です。Node.jsプロキシがTypeSafe Jevへ集約したジェスチャー指標を送り、型付きChoice結果を返します。APIキーを設定していない状態でも、ローカル判定で作品を操作できます。

`gamaccho/granular-flow` の `experiments/aftertouch` に保存したテスト実装です。[GitHub Pagesの公開テスト](https://gamaccho.github.io/granular-flow/aftertouch001/)からRenderのJevプロキシへ接続します。遅延・失敗時はローカル判定で動作します。[ギャラリー](https://gamaccho.github.io/granular-flow/)には平面版「AFTERTOUCH 001」と立体・テキスト非表示版「AFTERTOUCH 002」を別カードで掲載しています。リポジトリのルートから使う場合は、先に `cd experiments/aftertouch` でこのフォルダーへ移動してください。

## GitHub Pagesの公開テスト

SNS共有・画面収録用の [作品だけの表示](https://gamaccho.github.io/granular-flow/aftertouch001/?view=shoal&clean=1) は `clean=1` を指定します。タイトル、説明、判定、接続表示、操作ボタン、デバッグ表示、マウスカーソルを隠し、タッチ反応は通常版と共通です。PCのSpace（一時停止）、R（リセット）、F（全画面）は利用できます。URLから `clean=1` を外すと通常表示へ戻ります。

立体の渦の試作は [002 / SHOAL](https://gamaccho.github.io/granular-flow/aftertouch001/?view=shoal) で開けます。通常のURLは従来の平面版を保ちます。立体版はGPU上でXYZ位置・速度を更新し、空洞のある渦を下から見上げる視点で透視投影します。ゆっくり変わる視点と前後の明暗で奥行きを表現し、指の動きを画面から立体空間へ変換して毛足をなびかせます。光の繊維による表現で、魚の形や個体間の群れ行動を再現するモデルではありません。Jev接続・ローカル判定は共通です。自動検証はデスクトップとモバイル比率のChromiumで行い、iPhone実機の描画速度は未検証です。

公開先：**https://gamaccho.github.io/granular-flow/aftertouch001/**

画面には「001 / JEV」と表示します。動きに応じた描画とローカル判定を続けながら、集約した7項目のジェスチャー指標を `https://aftertouch-jev-proxy.onrender.com` へ送ります。実際のJev応答が返った場合だけ、左下に「Jev · ジェスチャー判定」と表示します。遅延・失敗時は理由付きのローカル判定を表示します。サーバーやAPIキーを公開ファイルに含めません。

```sh
npm ci
npm run build:pages
```

`.env.pages` に公開可能な接続先URLだけを保存しています。通信なしのプレビュー版を作る場合は `VITE_JEV_API_BASE= npm run build:pages` を実行してください。その版には「001 / PREVIEW」「公開テスト · ローカル判定（Jevなし）」と表示します。

生成された `dist` の内容をリポジトリの `aftertouch001/` に配置し、mainへ反映するとPagesで配信されます。アセットは相対URLなので、リポジトリのサブディレクトリから読み込めます。`VITE_JEV_API_BASE` が空の通常の `npm run dev` / `npm run build` では、従来どおり同じオリジンのプロキシへ接続します。

配信したビルドのブラウザーテストは、ローカルの静的HTTPサーバーまたは公開先を指定して実行できます。

```sh
AFTERTOUCH_CONNECTED_URL=https://gamaccho.github.io/granular-flow/aftertouch001/ \
AFTERTOUCH_EXPECTED_API_BASE=https://aftertouch-jev-proxy.onrender.com \
npm run test:browser -- --grep 'connected Pages'
```

上記テストはhealthと推論をブラウザー内で置き換え、ビルド済みクライアントの接続先と表示を検証します。実APIの成功確認とは別で、テストからAPI費用は発生しません。通信なし版の確認は、その版を配信したURLを `AFTERTOUCH_PREVIEW_URL` に指定し、`--grep 'static Pages preview'` で実行します。

モバイル表示の自動検証はChromeの端末エミュレーションです。iPhone実機のSafariでの速度・表示は別途確認してください。

## RenderでJevプロキシを公開

[Renderの設定済み作成画面を開く](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fgamaccho%2Fgranular-flow)

リポジトリのルートの `render.yaml` が、`aftertouch-jev-proxy` のWeb Serviceを定義しています。Freeプラン、Singapore、Node.js 22、対象フォルダー `experiments/aftertouch`、依存導入 `npm ci --omit=dev`、起動 `npm start`、health check `/api/health` を設定済みです。データベースやディスクは作成しません。

1. 上記リンクをRenderへログイン済みのブラウザーで開きます。
2. サービスとFreeプランを確認し、`TYPESAFE_API_KEY` の入力欄に有効なTypeSafe APIキーを入力します。キーはRender内で保管し、リポジトリやチャットに貼りません。
3. Deploy後、サービスがLiveになるのを確認し、ダッシュボードに表示される公開URLを控えます。ホスト名はRenderが割り当てるため、名前から推測しません。
4. 公開URLの `/api/health` がJSONを返すことを確認します。`provider: "jev"` はキー設定済みという意味です。実接続の確認には、推論応答の `source: "jev"` を確認してください。
5. 公開URLを `VITE_JEV_API_BASE` として指定してPages用フロントを再ビルドし、`aftertouch001/` に反映します。

```sh
VITE_JEV_API_BASE=https://YOUR-SERVICE.onrender.com npm run build:pages
```

上記URLは書式の例です。実際に発行されたHTTPSのオリジンだけを使用し、パス、クエリー、認証情報を含めません。これは公開可能な接続先設定で、APIキーとは別です。このリポジトリでは `.env.pages` に公開プロキシURLを保存済みです。`VITE_JEV_API_BASE=` を明示してビルドすると通信なし版になります。

GitHub Pagesからの接続許可は `ALLOWED_ORIGINS=https://gamaccho.github.io` に限定します。ブラウザーにAPIキーを渡しません。外部プロキシへの応答期限は1500ms、同じオリジンのローカル開発は従来どおり300msです。上流Jevへの期限は270msを維持し、待機中もローカル判定と描画を続けます。

このBlueprintは自動デプロイを無効にしています。プロキシのコードを更新した際は、RenderのManual Deployで反映してください。Freeサービスは無通信が15分続くと休止し、復帰に約1分かかります。復帰中は作品がローカル判定で動きます。[Render公式の制約](https://render.com/docs/free)

現在は `TRUST_PROXY=false` のため、Renderの中継IPが同じ接続は30回/分の制限を共有する場合があります。試験公開では保守的な設定を維持し、複数利用者向けに運用する段階でRenderの転送ヘッダーと経路を確認して調整します。CORSは利用者の認証ではありません。

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
- 擦っている間は指の進行方向を優先し、速い動きほど細いファイバーの毛足が長く伸びます。入力の間隔が空いた場合も、移動区間全体に力をかけます。接触半径は復元版の80%、毛足の基準長は1.5倍です。一本ごとの長さを基準の75〜125%に分散させ、先端の幅と光量を徐々に減らします。基本の流れと力の応答を保ち、青・紅・琥珀・紫の中にもシアン・コーラル・淡金・ローズの色合いがゆっくり移ります。
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
| `VITE_JEV_API_BASE` | ビルド時に埋め込む公開プロキシのHTTPSオリジン。Pagesでは `.env.pages` の値を使用。空を明示すればPages版は通信なし、通常版は同一オリジン。APIキーは設定しません |

`JEV_MOCK=true npm run dev` でキーを使わず接続経路を試せます。画面にはMOCKと表示します。Jevとして表示するのは実際に検証済みの上流応答が返った場合だけです。

IP制限は**単一Node.jsプロセスのメモリー**で管理し、再起動でリセットされます。複数インスタンスで公開する場合は、同等の制限を共有ストアまたはエッジ側へ移してください。Render用の作成設定を含みますが、実際のサービス作成にはログイン済みのRenderでAPIキーを入力してください。

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

- クライアントの判定トリガーは最低800ms間隔です。最初の判定には2点以上と120ms以上の観測時間が必要です。低フレームレートでも、点の数不足で推論が止まらないようにしています。実際の上流呼び出しは**最低2100ms間隔**にし、30回／分以内を継続できるようにします。途中もローカル判定・描画は続きます。
- プロキシはIP別の**直近60秒で最大30回**を制限します。既定で偽装された `X-Forwarded-For` を信頼しません。
- 上流の読み込み・JSON処理を含めて270msで中断し、ブラウザーは同じオリジンでは300ms、外部プロキシでは1500msでローカル判定に戻ります。同時リクエストや無制限再試行をしません。
- 60fpsの描画ループは推論を待たず、ポインターの物理作用は各フレームで反映します。ターゲット値は `current += (target - current) * min(1, deltaTime * 2.5)` で補間します。
- API推論の100ms未満、実機の60fpsは保証していません。通信環境やGPU性能に依存します。

## 描画・検証

位置・速度は浮動小数点テクスチャのping-pong更新、ファイバーの表示と残光もGPUで処理します。PCは16,384本、タッチ端末は9,216本です。ファイバーは幅の細い四角形をインスタンシングで描き、速度の方向に沿って長さを変えます。点から四角形に変えた分、本数を調整し、頂点数は従来の点描画と同じ予算に抑えています。光量は密度に合わせて補正します。指の速度は方向を保って制限し、速く擦る間はモードによる放射力よりも進行方向への追従を優先します。描画ピクセル数とDPRを制限し、継続的にフレームが遅い場合は解像度を下げます。非表示タブでは描画・推論を止めます。WebGL 2、`EXT_color_buffer_float` が必要です。非対応端末では理由を画面に表示します。

`?debug=1` で、fps、ファイバー数、接続種別、描画解像度を表示します。デバッグ時の `window.__AFTERTOUCH__.sampleMotion()` は256本分の実GPU状態を必要なときだけ読み出します。通常の描画ループにはCPUのファイバー更新やGPUの読み戻しを追加していません。停止・復帰、コンテキスト喪失時の表示、リサイズにも対応しています。

```sh
npm test
npm run build
npm run test:browser
```

ブラウザーテストにはインストール済みのGoogle Chromeを使用します。Chromeがない環境では `playwright.config.js` の `channel` を変更し、対応するPlaywrightブラウザーを導入してください。テスト用SwiftShaderは描画・操作の検証用途で、端末GPUの速度測定には使えません。実APIテストとスマートフォン実機テストは別途必要です。

初期実装時の確認：ビルド成功、入力・クライアント9件、実HTTPプロキシ14件、PC／モバイル表示6件、実際のVite→プロキシ接続1件が成功しました。画面キャプチャでPCとモバイルの配置も確認しています。

2026-10-01に実キーを設定したローカルプロキシを経由し、Jev実APIから `choice: "tender"`、`confidence: 0.66`、`source: "jev"` の応答を確認しました。成功時のプロキシ処理時間は166msでした。初回は270msの期限を超えてローカル判定に戻っています。この単発の成功は通信速度の保証や判定品質の評価ではありません。APIキーと `.env` はリポジトリに含めていません。

認証エラー表示を追加した後のローカル確認では、ビルドと入力・クライアント9件は成功しています。HTTPテスト14件の再実行は、作業環境のポート待受制限により実行できませんでした。このフォルダーの変更時はGitHub Actionsの **AFTERTOUCH checks** が、実キーを使わず `npm ci`、`npm test`、`npm run build` を実行します。スマートフォン実機の速度と判定品質は未検証です。

2026-10-01に公開Renderプロキシを確認しました。GitHub Pagesのオリジンに対するCORS preflightは204、許可オリジンは `https://gamaccho.github.io` でした。実推論では初めの2回が期限超過でローカル判定になり、3回目に `choice: "tender"`、`confidence: 0.62`、`source: "jev"`、プロキシ処理時間253msの応答を確認しました。通信の成功は確認していますが、毎回の成功や応答時間は保証していません。


### AFTERTOUCH 002 BGM

「深海旋回」(gamaccho) を非同期で読み込みます。映像や指操作では音は始まりません。
画面下中央の SOUND ON を押すと AudioContext を開始し、読み込み中なら完了後に再生します。
ボタンは実際の再生開始を確認してから消えます。BGM の停止・ミュート操作はありません。
clean 表示にも同じボタンを表示します。001 は従来どおり無音です。
読み込み・デコード・再生失敗は映像の描画を止めません。

`public/audio/deep-sea-loop.mp3` は元曲の冒頭・末尾の無音を除き、末尾と冒頭を
6 秒間クロスフェードしたループ用音源です。Web Audio の AudioBufferSourceNode.loop
でサンプル単位に繰り返すため、タイマー遅延や次の MP3 の読み込み待ちはありません。
配信音源は 32 kHz / stereo / 160 kbps に準備済みです。再生の AudioContext は
サンプルレートを指定せず端末の出力設定に従い、decodeAudioData で合わせます。
iPhone の画面収録時に音声経路が変わる場合との互換性を優先します。
再生成: `python3 scripts/prepare-bgm.py /path/to/深海旋回.mp3` (ffmpeg が必要)。
