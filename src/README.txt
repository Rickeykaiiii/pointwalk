Pointwalk — 固定展示版

直接以 Safari、Chrome 或 Edge 開啟 preview.html，即可離線觀看。
單檔已內嵌 Three.js 與跑步動畫，不需要安裝或連網。

設定
- 自動播放，跑步速度固定 1.0，顆粒大小固定 1.0。
- 無標題、說明文案或控制介面。
- 保留已確認的人物比例、雙臂整體前移、一腳一階與樓梯彎度。
- 每次跳躍後隨機跑 5–12 秒，再跨跳 3–4 級樓梯。
- 遠處階梯整級由下升起，近鏡頭時向下退出；人物附近的階梯保持穩定。
- 樹木高度、寬度與厚度各自隨機，保持緊貼樓梯邊緣；靠近鏡頭前整棵向下沉出畫面。
- 白色透明輪廓改用乾筆纖維、細微毛邊與濃淡紋理。
- 輕移滑鼠仍可微幅改變觀察角度；全螢幕可用瀏覽器功能。

來源
index.html：純動畫頁面
scene.js：點彩場景與固定播放設定
walker.js：白色筆觸人物輪廓
walker-gait.js：動畫重定向及樓梯落腳修正
stair-support.js：一腳一階的支撐位置
run-clip.js：Three.js AnimationMixer 播放原始動畫
vendor/quaternius-jog.js：Quaternius Jog_Fwd_Loop 原始關鍵影格（CC0）
MOTION-SOURCES.txt、vendor/QUATERNIUS-LICENSE.txt：動畫來源及授權
vendor/：Three.js 與 MIT 授權
preview.html：打包後的獨立離線版本

開發預覽：python3 -m http.server 8765 --bind 127.0.0.1
再開啟 http://127.0.0.1:8765

場景受 Cem Hasimi 作品啟發；未使用原作影片、圖片或工程檔。
