# EASY DRIVE — Tokyo test

渋谷・原宿・表参道・青山を含む枠内で、実際の道路網をランダムに巡るWebGL作品。

- データ: © OpenStreetMap contributors, ODbL 1.0 https://www.openstreetmap.org/copyright
- 取得: 2026-09-27、OpenStreetMap公式API 0.6 /map を4区画に分割。
- 走行範囲: 南35.654、北35.676、西139.697、東139.728。地区の行政界ではなく、4地区を含む作品用の長方形。
- `dist/map.json` はOSMから抽出・変換した地図データで、ODbL 1.0で提供。画面のDataリンクから取得できる。
- 道路の形状と接続、建物の平面輪郭、緑地、鉄道は実データを使用。道路幅・建物色・屋根の細部・樹木・地区表示は作品用に簡略化。
- 自動車で通行できる道路分類を抽出し、私道・自動車通行不可を除外。一方通行を考慮し、行き止まりを除去後、最大の強連結成分を使用。
- 交差点の詳細な右左折規制、実際の信号設置位置・点灯周期、交通、道路工事、建物の外観は再現対象外。速度は作品用の座標単位で、実速度のkm/h表示ではない。
- 最高速設定は151から300へ変更。狭い道路は185に制限し、先の曲率から減速を計算。車を中央に固定し、背景を移動。
- `node scripts/check-route.cjs`: 固定乱数で20分の走行を計算し、境界、4地区への到達、連続性、加速、経路メモリの上限を確認。
- PCブラウザで描画と縦長レイアウトを確認。スマートフォン実機でのフレームレートは未確認。

## 回遊・カラー更新

- Uターンをコストによる抑制から禁止へ変更。進入道路を含む状態グラフで、逆走への切り替えと約131度以上の反転を除外。残った最大の強連結成分内で行き先を結ぶため、目的地到着後も周回して継続できる。
- `node scripts/check-no-uturn.cjs`: 3つの乱数系列、300区間の連結、20,918回の道路遷移を検査。Uターン0、続行不能な経路状態0。20分の境界・地区巡回テストも通過。
- 道路 #3d5361、敷地 #e0e1da、建物はコンクリートグレー3色。屋根の縁・設備部分・窪み・影で凹凸を表現。緑と自動車は彩度を上げる。
- カメラは短辺660座標単位から400へ変更し、1.65倍に拡大。中心位置と速度の設定は維持。

## 屋上方向・敷地色・加速・信号更新

- 屋上設備と窪みは各建物の外壁から推定する直交軸に合わせて回転。影の光源方向は共通で維持。
- 敷地を #bacbd6、歩道を #a4bac7 に変更して青みを明確にする。
- 最高速300→720、加速70→360。細い道路は390、曲線は曲率に応じて減速。速度の単位は作品内座標でありkm/hではない。
- 74の主要交差点にフラットな3灯式信号と停止線を追加。交差方向ごとに青・黄・赤が切り替わり、赤信号では停止線の手前に停止、青信号で加速。設置位置・周期は作品用で、現実の信号情報ではない。
- 信号は走行と同じシミュレーション時刻を使うため、一時停止中は双方停止。進行方向を見て早めに減速し、低フレームレートでも赤信号を越えない上限処理を併用。
- 20分の計算で4地区巡回・境界内維持・赤信号越え0・停止後の発進を確認。最高速は約664に到達。急な速度落ちを検出する回帰確認も追加。

## 昼夕夜・道路上の信号更新

- 信号機180基を各進入道路の中心線上へ移動。ポールなしで路面の真上に表示し、停止線と信号制御は維持。
- 昼25秒・夕方10秒・夜25秒の60秒周期。各時間帯の最後3秒を次の環境光へのクロスフェードに含め、夜から昼への接続も連続化。
- 夜は青い環境光に切り替え、建物の輪郭に沿った窓明かりと自動車のヘッドライト・尾灯を点灯。ヘッドライトは車の進行方向を追従して地面を照らす。
- 照明は走行と同じ時刻で進み、一時停止や非表示中は周期も停止。
- 周期・境界での連続性・道路中心上の信号位置の自動検証を通過。スマートフォン実機の性能は未確認。
- Revision city-6: Signals now share the car's left-lane offset. Random starts are weighted by road length; destinations use all nodes of the safe circulation component, with randomized route costs. A boundary inset of 18 world units protects the lane offset.
- Caption: fixed 184 x 82 px, centered text, 97% opaque background, higher daytime contrast; long road names ellipsize.
- OSM details from the original official map API XML extracts retrieved 2026-09-27: 642 crossing segments (7 tagged Shibuya scramble ways), 176 footbridge/stair segments, 26 named Yamanote railway ways joined into 2 directional tracks. Explicit unmarked/no crossings are excluded. Node-only crossings use road width and orientation; marking style is illustrative, not confirmation of current paint conditions.
- Footbridges draw over the car and its light beam. Yamanote uses green 11-car trains with continuous path sampling and OSM bridge/tunnel visibility. Timings and speeds are artistic, not live train operations. Freight tracks are not used for these trains.
- Validation: 50 distinct starting roads and 50 destinations in 50 seeded runs; 20-minute simulation visits all 4 districts, stays bounded and crosses no red signals; 300 route joins have no U-turns. All 180 signals align with the driving lane. Browser checks cover scramble zebras, car occlusion beneath a footbridge and both Yamanote trains. Actual smartphone performance remains unverified.

## Revision city-7

- Caption width reduced from 184 to 112 px, fixed for the longest district label. Daytime ink is #081119 with a heavier district weight. Text contrast is also retained during environment crossfades.
- All zebra fragments are clipped with an 8-bit WebGL stencil built from the actual road surfaces, including the scramble pavement. Crossing endpoints and stripe corners cannot paint sidewalks or land beyond the rendered road boundary.
- Yamanote runs three spaced 11-car services per direction at 150 world units/s. Motion uses the shared simulation clock, continues while the car waits at red lights, and pauses with the artwork. Trains enter and leave at the ends of mapped tracks.
- City motion and environment checks passed; browser checks verify clipping and moving trains against a fixed camera.

## Revision city-8

- Tree placement rejects road overlaps using a spatial road-segment index and full crown/shadow clearance, plus a road stencil exclusion for tree rendering. 236 tree candidates removed; 3921 retained.
- Day caption ink matches road #3d5361. The pause button is removed; playback starts automatically. A fixed bottom-right analog arc/needle and digital speed gauge follows the actual animation speed (artwork units, not km/h).
- Crows circle and flap above mapped green polygons. Lightweight batched silhouettes are culled outside the view. A single 22%-maximum-opacity cloud drifts across during seconds 5-20 of each 60-second day/evening/night cycle; absent in evening/night.
- Road clearance, road-color ink, environment tests and JavaScript syntax checks passed. Smartphone device performance is unverified.

## Revision city-9

- OpenStreetMap credit background is transparent; a subtle text shadow preserves legibility.
- Speed display maps the existing 0-720 driving range to 0-95 km/h for presentation only. Two SVG seven-segment digits, 39 gauge ticks, and 0/95 dial limits added. Actual vehicle dynamics unchanged.
- Clouds now use deterministic world-space anchors and drift at 8,2 world units per second. Camera position is used only for rendering/culling, never to move or spawn a cloud. The daylight fade remains. Camera-independent drift and speed endpoints checked; seven-segment rendering verified in browser.

## Revision city-10

- Seven-segment digits scaled to 70% (26.6 x 20.3 px), centered within the existing readout area. Unlit segments are transparent so the dial itself shows through without a contrasting segment shape.
- Credit text shadow is disabled throughout the day phase; evening/night retain their existing treatment.

## city-11: captions and crossing approaches

Day caption ink uses the rendered road RGB including ambient multiplication; strengthened glyph coverage. Relocated 72 side-road crossing geometries behind wider main-road pavement, retaining original OSM coordinates in sourceP. These are artwork layout adjustments, not a new physical survey. Signal stop lines now use crossing near-edge clearance along approach polylines (98 approaches with crossings), and route stop events project onto those same stop lines with the car center 18 units behind.

Validation: 1,200 simulated seconds, no red-line crossings; signal/environment checks passed. Local WebGL view confirmed a car behind the stop line and crossing with no console errors.

## city-12: connected crossing placement and music

Crossing alignment follows connected road segments (143 relocated from source coordinates). Stop lines inspect the complete lane span and can retreat onto the aligned predecessor road; all 180 stop lines pass crossing-envelope non-overlap audit. Route events are sorted and ignore a stop line that the selected approach path never traverses. 1,200-second route simulation: no red stop-event crossings.

User supplied Bui Bui Boo.mp3: decoded locally with Web Audio, 96.400 seconds; two scheduled voices overlap for exactly four seconds with complementary linear fades. A 50px music-note button beside the meter starts/stops playback; hidden pages stop audio. MP3 decode/start and UI verified in browser; audio-clock overlap and stop cancellation verified with a mocked clock. Actual listening on phone not tested.

## city-13: music playback session and button state
Set supported AudioSession to playback before resuming Web Audio, addressing the possible iOS silent-switch cause. Recheck running state after decode and resume; display || only after successful startup, restore ♪ on stop/error. Browser start/stop labels and glyphs verified; mocked 4-second loop regression passed. User-device audible output remains unverified.
