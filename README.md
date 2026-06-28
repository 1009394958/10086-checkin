# 中国移动每日签到 (Quantumult X)

> 基于 Quantumult X 的中国移动 App 每日自动签到脚本
>
> 先查剩余次数 → 完成任务得次数 → 执行抽奖

## 快速开始（5分钟配置）

---

### 第一步：下载三个脚本到本地

将以下3个文件保存到 **Quantumult X → 设置 → 文件 → Scripts** 文件夹：

| 文件 | 下载链接 |
|------|----------|
| `10086_cookie.js` | [右键另存为](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_cookie.js) |
| `10086_body.js` | [右键另存为](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_body.js) |
| `10086_checkin.js` | [右键另存为](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js) |

> **务必**：不要使用远程URL，全部下载到本地，否则会 timeout 超时！

---

### 第二步：添加 Quantumult X 配置

点开 Quantumult X → 设置 → 配置文件 → 编辑配置，在 `[rewrite_local]` 和 `[task_local]` 和 `[mitm]` 区域分别粘贴以下内容：

**1. 找到 `[rewrite_local]` 区域，粘贴：**

```ini
[rewrite_local]
; ===== 10086_cookie.js - 捕获登录凭证 =====
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_cookie.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_cookie.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_cookie.js

; ===== 10086_body.js - 捕获加密请求体 =====
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-body 10086_body.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-body 10086_body.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-body 10086_body.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-body 10086_body.js
```

**2. 找到 `[task_local]` 区域，粘贴：**

```ini
[task_local]
0 9 * * * 10086_checkin.js, tag=中国移动签到, enabled=true
```

**3. 找到 `[mitm]` 区域，粘贴：**

```ini
[mitm]
hostname = client.app.coc.10086.cn, clientaccess.10086.cn, wx.10086.cn
```

---

### 第三步：捕获登录凭证

1. 确保 **Quantumult X VPN 已开启**（状态栏显示VPN图标）
2. **打开中国移动 App**，等待加载到首页
3. 观察 Quantumult X 的日志弹窗，如果出现 `捕获` 字样说明成功
4. 首次捕获成功后关闭 App 即可

---

### 第四步：运行签到

1. 打开 Quantumult X
2. 底部 → 「设置」→ 顶部「构造请求」
3. 选择「任务」标签
4. 找到「中国移动签到」，点击 ▶ 运行
5. 查看运行日志确认结果

---

## 查看日志

Quantumult X 中查看详细日志的位置：

**路径：** 设置 → 构造请求 → 日志

日志中你将会看到：

```
════════════════════════════════════════════
  中国移动每日签到脚本 v2.2
════════════════════════════════════════════
  开始时间: 2026/6/28 09:00:00
  运行模式: task模式 → 执行签到流程

  ▶ 【步骤0】检查登录凭证
    ✓ Cookie → JSESSIONID=xxx; UID=xxx... (长度: 120)
    ✓ x-token → abc123...
    ✗ QWHD Cookie → 未捕获（不影响原生API）

    方案首选: 幸运转转转 Web API
    ✗ 缺少QWHD_COOKIE → 无法使用Web API，降级到原生API
    获取方式: 打开一次幸运转转转页面，脚本会自动捕获

    方案回退: 原生加密API
  ▶ 【步骤1】调用getUserInformation验证登录
    ✓ 加密请求体已就绪 → 1432 bytes
    ⇄ getUserInformation: HTTP 200, body=108B
    ✓ 登录验证通过
════════════════════════════════════════════
  脚本执行完毕
════════════════════════════════════════════
```

---

## 日志标识说明

| 标识 | 含义 |
|------|------|
| ▶ 【步骤N】 | 当前执行到第几步 |
| ✓ | 成功 |
| ✗ | 失败 |
| ℹ | 提示信息 |
| 📦 | 数据内容 |
| ⇄ | API请求/响应 |
| ═════ | 阶段分隔线 |
| ─── | 子任务分隔线 |

---

## 如何获取 QWHD_COOKIE（使用Web API需要）

如果想让脚本走 Web API（幸运转转转，可解析剩余次数和抽奖结果），需要捕获 QWHD Cookie：

1. 在 Quantumult X 的 MITM 中添加 `wx.10086.cn`（上面第三步已添加）
2. 打开中国移动App → 进入「幸运转转转」活动页面
3. 转盘页面加载时，脚本会自动捕获 `QWHD_SESSION_TOKEN` 存入 `10086_qwhd_cookie`

> 如果不需要幸运转转转功能，只做"签到有礼"基础签到，可以不配置这一步。

---

## 文件结构

```
10086-checkin/
├── 10086_cookie.js       v1.1  捕获Cookie/Tokens（script-request-header，无阻塞）
├── 10086_body.js         v1.0  捕获加密请求体（script-request-body）
├── 10086_checkin.js      v2.2  签到主脚本（task，带详细日志）
│                         ├── 阶段1: 查剩余抽奖次数
│                         ├── 阶段2: 完成任务赚次数
│                         └── 阶段3: 执行抽奖
├── config/quantumultx.conf   完整配置模板
├── boxjs.json               BoxJS面板管理
└── README.md                本文件
```

---

## 技术背景

### 中国移动API加密体系

所有 `client.app.coc.10086.cn` 和 `clientaccess.10086.cn` 的请求均使用AES加密：

- 请求/响应体以 `ykytces3` 开头的密文
- 请求头包含 `x-sign`（签名）、`x-nonce`（随机数）、`x-token`（令牌，每次响应轮换）、`x-time`（时间戳）
- `x-token` 通过响应头 `r-token` 定期轮换

### 幸运转转转 Web API（无加密）

`wx.10086.cn/qwhdhub/` 域下的API使用标准JSON，可正常解析：

| API | 方法 | 功能 |
|-----|------|------|
| `/lottery/remain` | POST | 查询剩余抽奖次数 |
| `/task/pop` | GET | 获取任务列表 |
| `/jump/startGame` | POST | 执行抽奖 |
| `/jump/endGame` | POST | 结束本轮游戏 |
| `/jump/currentPhase` | POST | 获取活动阶段信息 |

---

## License

MIT
