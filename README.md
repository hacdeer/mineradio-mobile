# 🎵 Mineradio Mobile

基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) 桌面版的 Capacitor 移动端移植。

> **最快试用方式**: 直接用手机浏览器打开 → [方案A](#方案a-立即试用-pwa-方式无需编译)

---

## 📂 项目结构

```
mineradio-mobile/
├── public/              # Web 前端源码
│   ├── index.html       # 主页面 (26K+ 行 SPA, 已适配移动端)
│   ├── vendor/          # Three.js, GSAP, music-tempo
│   ├── assets/          # 3D 模型, 图标
│   └── manifest.json    # PWA 清单
├── www/                 # Vite 构建产物
├── server/              # 后端 API 服务
│   ├── server.js        # 原始 API 代理 (网易云 + QQ音乐)
│   ├── dj-analyzer.js   # DJ 数据分析
│   └── mobile-server.js # 移动端一体化服务器 (API + 静态文件)
├── android/             # Capacitor Android 原生项目
├── capacitor.config.json
├── vite.config.js
└── adapt-mobile.js      # 移动端适配脚本
```

---

## 方案A: 立即试用 (PWA 方式，无需编译)

### 1. 启动服务器

```bash
cd mineradio-mobile
node server/mobile-server.js
```

输出示例：
```
╔══════════════════════════════════════════════════╗
║        🎵 Mineradio Mobile Server 🎵            ║
╠══════════════════════════════════════════════════╣
║  API Proxy  : http://127.0.0.1:3001              ║
║  PWA Frontend : http://0.0.0.0:3000              ║
╠══════════════════════════════════════════════════╣
║  在手机上打开:                                    ║
║  http://192.168.1.100:3000                        ║
╚══════════════════════════════════════════════════╝
```

### 2. 手机连接

- 确保手机和电脑在**同一 WiFi 网络**
- 手机浏览器打开 `http://<显示的IP>:3000`
- 首次打开会弹出"服务器连接"页面，输入地址后即可使用
- **iPhone**: Safari 点分享 → "添加到主屏幕" → 获得类原生体验
- **Android**: Chrome 点菜单 → "添加到主屏幕" → 获得类原生体验

### 3. 扫码登录

- 点击右上角头像 → 选择"网易云"或"QQ音乐"
- 扫码登录后同步你的歌单和播客

---

## 方案B: 构建 Android APK

### 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| **Node.js** | ≥18 | |
| **Android Studio** | Hedgehog+ | 需要 Android SDK 34+ |
| **JDK** | 17 | Android Studio 自带 |
| **Gradle** | 8.x | Android Studio 自带 |

### 构建步骤

```bash
# 1. 安装依赖
cd mineradio-mobile
npm install

# 2. 构建 Web 前端
npm run build

# 3. 同步到 Android 项目
npx cap sync android

# 4. 打开 Android Studio 构建 APK
npx cap open android
```

在 Android Studio 中：
- 等待 Gradle 同步完成
- `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`

### 一键构建 (需要 Android SDK)

配置 `ANDROID_HOME` 环境变量后：
```bash
npm run build:android
cd android && ./gradlew assembleDebug
```

---

## 方案C: 构建 iOS IPA (需要 Mac)

```bash
cd mineradio-mobile
npm install
npm run build
npx cap sync ios
npx cap open ios
```

在 Xcode 中：
- 选择 Signing Team
- `Product` → `Archive` → `Distribute App`

---

## ⚙️ 服务器部署选项

### 选项1: 本地电脑 (开发用)

```bash
node server/mobile-server.js
# 手机通过局域网 IP 访问
```

### 选项2: 云部署 (随时随地使用)

#### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

```bash
# 或用 Railway CLI
railway login
railway init
railway up
```

#### 自建 VPS

```bash
# 1. 上传 server/ 和 www/ 到 VPS
scp -r server www user@vps:/opt/mineradio/

# 2. 安装依赖
ssh user@vps
cd /opt/mineradio/server
npm install NeteaseCloudMusicApi mpg123-decoder

# 3. 运行
node mobile-server.js

# 4. 配置反向代理 (Nginx)
# server {
#   listen 80;
#   server_name radio.your-domain.com;
#   location / { proxy_pass http://127.0.0.1:3000; }
# }
```

---

## 🔧 移动端适配详情

相比桌面版，移动端做了以下适配：

| 适配项 | 说明 |
|--------|------|
| **桌面元素隐藏** | 移除标题栏、窗口控制、桌面歌词按钮 |
| **底部导航栏** | 新增首页/搜索/歌单/设置四Tab导航 |
| **安全区域** | 适配刘海屏 + 底部指示条安全区 |
| **触摸优化** | 最小触控区域 44x44pt，增大列表项间距 |
| **粒子降级** | 根据屏幕宽度自动降低粒子密度 (0.5x~0.7x) |
| **服务器配置** | 首次启动引导输入服务器地址，支持保存 |
| **PWA 支持** | 可添加到主屏幕，拥有独立应用图标 |
| **API 代理层** | 自动将 /api/* 请求转发到已配置的服务器 |
| **视口适配** | 使用 dvh 单位，解决移动端 100vh 滚动问题 |
| **缩放防护** | input 最小字号 16px，防止 iOS 自动缩放 |

---

## ⚠️ 注意事项

1. **非官方客户端**: 本项目不是网易云音乐或 QQ 音乐的官方客户端
2. **不破解付费**: 不会绕过平台付费/会员限制，付费内容需自行开通
3. **本地播放辅助**: 仅作为个人学习与本地播放辅助使用
4. **开源协议**: 基于 GPL-3.0 开源，继承原项目协议
5. **隐私保护**: 所有数据本地存储，不收集用户信息

---

## 📱 与原版对比

| 功能 | 桌面版 | 移动版 |
|------|--------|--------|
| 网易云音乐 | ✅ | ✅ |
| QQ 音乐 | ✅ | ✅ |
| 天气电台 | ✅ | ✅ |
| 3D 粒子视觉 | ✅ (全量) | ✅ (降级，GPU自适应) |
| 3D 歌单架 | ✅ | ✅ (WebGL) |
| 歌词舞台 | ✅ | ✅ |
| 桌面歌词 | ✅ (独立窗口) | ❌ |
| 银河壁纸 | ✅ | ✅ |
| 桌面窗口控制 | ✅ | ❌ |
| 移动底部导航 | ❌ | ✅ |
| PWA 安装 | ❌ | ✅ |
| 系统状态栏适配 | ❌ | ✅ (安全区域) |

---

## 🚀 快速命令

```bash
npm run dev           # 启动 Vite 开发服务器
npm run build         # 构建 Web 前端
npm run sync          # 同步到 Capacitor
npm run open:android  # 在 Android Studio 打开
npm run open:ios      # 在 Xcode 打开
npm run build:android # 构建 + 同步 Android
npm run build:ios     # 构建 + 同步 iOS
```

---

## 📄 License

GPL-3.0 — 继承自 [Mineradio](https://github.com/XxHuberrr/Mineradio)
