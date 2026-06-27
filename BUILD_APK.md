# 构建 Android APK 指南

## 第一步：安装 Android Studio

1. 下载 [Android Studio](https://developer.android.com/studio) (Hedgehog 或更新版本)
2. 安装时勾选 **Android SDK** 和 **Android Virtual Device**
3. 安装完成后打开 Android Studio，在 SDK Manager 中安装 **Android 14 (API 34)**

## 第二步：构建 APK

```bash
# 在 mineradio-mobile 目录下
cd mineradio-mobile

# 安装依赖
npm install

# 构建前端
npm run build

# 同步到 Android 项目
npx cap sync android

# 用 Android Studio 打开
npx cap open android
```

在 Android Studio 中：
- 等待 Gradle 同步完成（首次需要下载，可能 5-10 分钟）
- 菜单：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

## 第三步：安装到手机

```bash
# 用 adb 安装（手机需开启 USB 调试）
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 或直接把 APK 传到手机，用文件管理器打开安装
```

---

## 配置服务器地址

首次打开 App 会弹出"服务器连接"页面，输入你的云服务器地址：

```
# Railway 部署后：
https://mineradio-xxx.up.railway.app

# 或直接连电脑上的测试服务器：
http://192.168.43.188:3000
```

---

## 一键部署服务器到 Railway

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 部署
railway up
```

或者直接在 [railway.app](https://railway.app) 上：
1. New Project → Deploy from GitHub
2. 选择 mineradio-mobile 仓库
3. Start Command: `node server/cloud-server.js`
4. 自动部署完成，获得公网 URL
