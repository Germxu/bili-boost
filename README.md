# Bili Boost

一个给 B站 做功能优化的 Chrome 扩展（Manifest V3）。目前实现了评论区 IP 属地显示、滚轮倍速播放和视频帧读取，其余功能预留中。

## 功能

- **评论区 IP 属地显示**：在视频评论的日期旁显示发布者的 IP 属地。兼容 B站 的 Lit / Shadow DOM 新版评论区，采用 MAIN world 注入读取组件内部数据。
- **滚轮倍速播放**：鼠标悬停在播放器的「倍速」按钮上滚动即可调速，右键恢复 1x。
  - 范围 0.25x–5x；2x 以内每档 0.05x，2x 以上每档 0.3x。
  - 只在倍速按钮/菜单上拦截滚轮，不影响 B站 原生的音量滚轮。
  - 开启「记住倍速」后，速度以本机 `localStorage` 的 `biliBoost_lastPlaybackRate` 为主，全站通用、新视频自动应用；`chrome.storage.sync` 仅作跨设备辅助同步，有同步值就更新本地，同步失败也不影响本地使用。
- **视频帧读取**：点击播放器左下角时间戳旁的相机按钮，或点 popup 的「截取当前帧」按钮，把当前画面保存为原始分辨率的 PNG，文件名格式为 `视频标题_视频内时间点.png`。始终可用，无需开关。
- **顶部导航自定义 / 沉浸式进度条**：规划中，popup 里已预留开关，暂未实现。

## 安装

### 方式一：直接加载（推荐）

仓库的 `dist/` 目录已包含构建好的产物，可直接使用：

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions`，开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择仓库中的 `dist/` 目录。

### 方式二：从源码构建

需要 Node.js 环境（建议 20+）。

```bash
npm install
npm run build
```

构建产物在 `dist/`，按上面方式一加载即可。

## 使用

- 点击工具栏扩展图标打开 popup，开关各个功能、调整倍速设置、截取当前帧。
- 首次启用「评论区 IP 属地显示」后，刷新视频页生效。
- 调速时把鼠标放到播放器控制条的「倍速」按钮上滚动；右键该按钮恢复 1x。
- 截图无需开关，装好后点播放器左下角时间戳旁的相机按钮，或点 popup 的「截取当前帧」。

> 注意：在 `chrome://extensions` 重新加载扩展后，需要刷新已打开的 B站 页面，旧页面的 content script 才会被替换。

## 开发

```bash
npm run dev        # 启动 Vite 开发模式（含 MAIN world 脚本预编译）
npm run typecheck  # 类型检查（主项目 + MAIN world 脚本）
npm run build      # 生产构建
```

### 技术选型

- **Vite 8 + TypeScript 5.9 + @crxjs/vite-plugin 3 + Manifest V3**。
- 页面逻辑使用原生 DOM/TS，不引入 React/Vue：这些功能都是修改 B站 现有 DOM、挂事件监听，虚拟 DOM 反而增加注入和样式隔离成本。
- MAIN world 脚本 `src/main-world/ip-location.ts` 是独立编译的 IIFE（见其专属 `tsconfig.json`），编译到 `public/ip-location.js`，再由 Vite 复制进 `dist/`。它是生成产物，不要直接编辑。
- content script 入口为 `index.iife.ts`，以 IIFE 形式打包，满足 `document_start` 的同步注入时序。

### 目录结构

```
bili-boost/
├── manifest.json                  # MV3 配置
├── src/
│   ├── background/                # service worker，负责 MAIN world 脚本注入
│   ├── content/
│   │   ├── index.iife.ts          # content 入口，按开关启停功能
│   │   └── features/              # 各功能实现（comment-ip / speed-wheel）
│   ├── main-world/                # 注入页面 MAIN world 的脚本（TS 源码）
│   ├── popup/                     # 扩展弹窗界面
│   └── shared/                    # 类型、常量、存储、日志、运行时判断
├── public/
│   ├── icons/                     # 扩展图标（128px）
│   └── ip-location.js             # MAIN world 脚本的编译产物
├── icons/icon-source.png          # 图标源图
└── dist/                          # 构建产物，可直接加载
```

### 权限说明

- `storage`：读写功能开关与倍速设置。
- `scripting`：向页面 MAIN world 注入 IP 属地脚本。
- `host_permissions: *://*.bilibili.com/*`：仅在 B站 域名下运行。
