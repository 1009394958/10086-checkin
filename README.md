# 中国移动每日签到 (Quantumult X)

> 基于 Quantumult X 的中国移动 App 每日自动签到脚本

## 快速开始 🚀

### 第一步：下载脚本到本地

| 文件 | 下载 | 作用 |
|------|------|------|
| `10086_capture.js` | [下载](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_capture.js) | 统一捕获Cookie+Token+加密体 |
| `10086_checkin.js` | [下载](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js) | 执行签到（本文件） |

保存到 `Quantumult X/Scripts/` 目录。

> ⚠️ **必须下载到本地**，不要使用远程URL，否则会超时！

### 第二步：添加 Quantumult X 配置

在设置 → 配置文件 → 编辑配置，添加：

```ini
[rewrite_local]
; 统一捕获：一个脚本同时捕获 Cookie + x-token + 加密请求体
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_capture.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_capture.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_capture.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-header 10086_capture.js

[task_local]
0 9 * * * 10086_checkin.js, tag=中国移动签到, enabled=true

[mitm]
hostname = client.app.coc.10086.cn, clientaccess.10086.cn, wx.10086.cn
```

### 第三步：捕获登录凭证

1. 开启 Quantumult X VPN
2. **打开中国移动 App**，等待加载到首页
3. 观察日志出现「成功捕获: Cookie, x-token, 加密体」字样
4. 关闭 App

### 第四步：运行签到

Quantumult X → 设置 → 构造请求 → 任务 → 点击「中国移动签到」运行

---

## 日志解读

运行签到后，在「设置 → 构造请求 → 日志」中可以看到：

```
════════════════════════════════════════════
  中国移动每日签到脚本 v2.3
════════════════════════════════════════════

  ▶ 【步骤0】检查登录凭证
    ✓ 原生Cookie → 长度154
    ✓ x-token → m1TKrmFZeN5mFNKn...
    ✓ 加密请求体 → [10086_body_enc] 1432 bytes
    ✗ QWHD Cookie → 未捕获

    方案A: 幸运转转转 Web API
    ✗ 缺少QWHD_COOKIE → 如需此功能请看下方

    方案B: 原生加密API / 签到有礼
  ▶ 【步骤1】验证登录...
    ⇄ getUserInformation: HTTP 200, body=108B
    ✓ 签到成功
════════════════════════════════════════════
```

---

## 如何启用「幸运转转转」Web API

如果想让脚本使用Web API（可解析剩余次数和奖品名称），需要额外捕获 QWHD Cookie：

1. 确保 `[mitm]` 中已包含 `wx.10086.cn`（上方配置已包含）
2. 打开中国移动 App → 进入「幸运转转转」活动页面
3. `10086_capture.js` 会自动捕获 `QWHD_SESSION_TOKEN` Cookie
4. 之后运行签到脚本会自动优先使用 Web API

---

## 文件结构

```
10086-checkin/
├── 10086_capture.js    统一捕获脚本（替代旧版 cookie.js + body.js）
├── 10086_checkin.js    v2.3 签到主脚本
│   ├── 阶段0: 检查凭证
│   ├── 方案A: Web API（查次数→任务→抽奖）
│   └── 方案B: 原生加密API
├── config/quantumultx.conf  完整配置模板
└── README.md
```

---

## 技术说明

### 中国移动 API 加密体系
- 请求/响应体 AES 加密，密文以 `ykytces3` 开头
- 请求头: `x-token`（令牌，响应头 `r-token` 轮换）、`x-sign`（签名）、`x-nonce`（随机数）、`x-time`（时间戳）

### 幸运转转转 Web API（未加密）
| API | 方法 | 功能 |
|-----|------|------|
| `/lottery/remain` | POST | 查询剩余抽奖次数 |
| `/task/pop` | GET | 获取任务列表 |
| `/jump/startGame` | POST | 执行抽奖 |
| `/jump/endGame` | POST | 结束本轮 |

---

## License

MIT
