# Experiments

作品の試作・API連携の検証用ソースを保存します。各実装は、自分のフォルダー内で依存の導入、起動、テストを行います。

| 実装 | 内容 | 現在の状態 |
| --- | --- | --- |
| [AFTERTOUCH](aftertouch/README.md) | Three.jsのGPU粒子描画とTypeSafe Jevによるジェスチャー分類 | [Pages公開テスト](https://gamaccho.github.io/granular-flow/aftertouch001/)からRenderのJevプロキシへ接続。2026-10-01に実API応答を確認。遅延時はローカル判定 |

## 今後の運用

まずこのリポジトリの実験用フォルダーで、表現とAPI連携を検証します。公開に進めるときは、フロントエンドの公開と、APIキーを保持するプロキシの運用をそれぞれ整えます。GitHub Pagesは静的サイト用なので、Node.jsプロキシは別のホスティング先が必要です。

Jevを使う作品が増えた段階で、プロキシを専用のサービス・リポジトリへ切り出すと、APIキー、呼び出し制限、更新をまとめて管理できます。AFTERTOUCHのPages版は `VITE_JEV_API_BASE` でRenderへ接続し、通常のローカル開発は同じオリジンの `/api` を使います。

完成した作品のギャラリー掲載は、公開URLと実機での動作を確認した段階で行います。
