# Pointwalk

Three.js 點彩階梯動畫：白色筆觸小人一腳一階奔跑，隨機下蹲後跨階跳躍，樹木與階梯逐步升起、沉下。

速度與顆粒大小固定 1.0；無控制介面或文案。所有執行資源內嵌，可離線觀看。

## 線上觀看

[開啟 Pointwalk](https://rickeykaiiii.github.io/pointwalk/)

[GitHub 原始碼](https://github.com/Rickeykaiiii/pointwalk)

## 直接觀看

開啟 `dist/index.html`，或執行 `npm run dev` 後瀏覽 http://localhost:8765 。後者需要 Python 3。

## 開發

需要 Node.js 22 與 npm。

```sh
npm ci
npm run build
npm run dev
```

修改 `src/` 後重新 build；`dist/index.html` 是單檔發佈版本。

## 上傳 GitHub 與發佈 Pages

1. 建立 GitHub repository，將本資料夾內容推送至 `main` 分支（包含 `.github` 隱藏資料夾）。
2. 在 repository 的 Settings → Pages → Build and deployment，選擇 **GitHub Actions**。
3. Actions 中執行 Deploy GitHub Pages；後續推送 `main` 會自動重建與部署。

```sh
git init
git add .
git commit -m "Initial Pointwalk project"
git branch -M main
git remote add origin <你的 GitHub repository URL>
git push -u origin main
```

此專案部署於 GitHub Pages；推送至 main 分支會重新建置並部署。

## 結構

- `src/scene.js`：場景、樹木、星空、階梯
- `src/walker.js`：白色筆觸輪廓
- `src/walker-gait.js`：跑步動畫重定向、落腳與收腿
- `src/stair-support.js`：左右腳交替上階
- `src/jump-schedule.js`：隨機跳躍及 0.45 秒下蹲
- `src/run-clip.js`：原始動畫播放
- `scripts/build.mjs`：產生離線單檔
- `.github/workflows/pages.yml`：GitHub Pages 部署

## 第三方來源與授權

Three.js 採 MIT 授權，見 `src/vendor/THREE-LICENSE.txt`。
Quaternius `Jog_Fwd_Loop` 動畫採 CC0，見 `src/vendor/QUATERNIUS-LICENSE.txt` 與 `src/MOTION-SOURCES.txt`。
場景受 Cem Hasimi 作品啟發，未包含原作影片、圖片或工程檔。
