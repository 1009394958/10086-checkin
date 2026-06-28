# 中国移动每日签到 + 余额查询 (Quantumult X)

> 基于 Quantumult X 的中国移动 App 每日自动签到 + 话费/流量/积分查询

## 快速开始 🚀

### 第一步：下载脚本到本地

| 文件 | 下载 | 作用 |
|------|------|------|
| `10086_capture.js` | [下载](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_capture.js) | 统一捕获Cookie+Token+加密体 |
| `10086_checkin.js` | [下载](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js) | 执行签到+余额查询（本文件） |

保存到 `Quantumult X/Scripts/` 目录。

> ⚠️ **必须下载到本地**，不要使用远程URL，否则会超时！

### 第二步：添加 Quantumult X 配置

在设置 → 配置文件 → 编辑配置，添加：

```ini
[rewrite_local]
; 统一捕获：一个脚本同时捕获 Cookie + x-token + 加密请求体 + 话费/流量API
^https:\\/\\/client\\.app\\.coc\\.10086\\.cn\\/biz-orange\\/LN\\/uamonekeylogin\\/autoLogin url script-request-header 10086_capture.js
^https:\\/\\/clientaccess\\.10086\\.cn\\/biz-orange\\/BN\\/userInformationService\\/getUserInformation url script-request-header 10086_capture.js
^https:\\/\\/client\\.app\\.coc\\.10086\\.cn\\/leadeon-abilityopen-biz\\/BN\\/obtainToken\\/getBigNetToken url script-request-header 10086_capture.js
^https:\\/\\/clientaccess\\.10086\\.cn\\/biz-orange\\/BN\\/scoreQueryService\\/getScoreQuery url script-request-header 10086_capture.js
^https:\\/\\/clientaccess\\.10086\\.cn\\/biz-orange\\/BN\\/realFeeQuery\\/getRealFee url script-request-header 10086_capture.js
^https:\\/\\/clientaccess\\.10086\\.cn\\/biz-orange\\/BH\\/newPlanRemainQry\\/getNewPlanRemainQry url script-request-header 10086_capture.js

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

## 功能说明

脚本执行分为**三个阶段**：

### 阶段一：余额查询
- 💰 话费余额 → `realFeeQuery` API
- 📱 流量/套餐余额 → `newPlanRemainQry` API
- ⭐ 积分查询 → `scoreQueryService` API

> ⚠️ 话费和流量API响应体加密，无法直接解密显示具体数值。
> 但API调用成功（HTTP 200）即表示余额数据已获取，可在App中查看。

### 阶段二：幸运转转转签到
- 需要额外捕获 `QWHD Cookie`（打开转盘页面自动捕获）
- 自动查询剩余抽奖次数 → 做任务 → 抽奖

### 阶段三：原生API签到
- 调用 `getUserInformation` 接口完成签到
- 自动更新 `x-token`（响应头 `r-token` 轮换）

---

## 日志解读

运行签到后，在「设置 → 构造请求 → 日志」中可以看到：

```
════════════════════════════════════════════
  中国移动全能脚本 v3.0
════════════════════════════════════════════

  ▶ 【步骤0】检查登录凭证
    ✓ Cookie → 长度154
    ✓ x-token → m1TKrmFZeN5mFNKn...
    ✓ 加密请求体 → [10086_body_enc] 1432 bytes
    ℹ QWHD Cookie未捕获（不影响核心功能）

════════════════════════════════════════════
  阶段一: 话费/流量查询
════════════════════════════════════════════
  ▶ 【步骤1】查询话费余额
    ⇄ realFeeQuery: HTTP 200, body=108B
    ✓ 话费查询完成
  ▶ 【步骤2】查询流量/套餐余额
    ⇄ newPlanRemainQry: HTTP 200, body=96B
    ✓ 流量查询完成
  ▶ 【步骤3】查询积分
    ⇄ scoreQuery: HTTP 200, body=88B
    ✓ 积分查询完成

════════════════════════════════════════════
  阶段三: 原生API签到
════════════════════════════════════════════
  ▶ 【步骤5】使用原生API签到
    ⇄ getUserInformation: HTTP 200, body=108B
    ✓ 签到成功
    ℹ x-token已更新
════════════════════════════════════════════
```

---

## 如何启用「幸运转转转」Web API

1. 确保 `[mitm]` 中已包含 `wx.10086.cn`（上方配置已包含）
2. 打开中国移动 App → 进入「幸运转转转」活动页面
3. `10086_capture.js` 会自动捕获 `QWHD_SESSION_TOKEN` Cookie
4. 之后运行签到脚本会自动优先使用 Web API

---

## 文件结构

```
10086-checkin/
├── 10086_capture.js          统一捕获脚本（Cookie + 加密体 + 余额API）
├── 10086_checkin.js          v3.0 签到+余额查询主脚本
├── config/
│   └── quantumultx.conf      完整配置模板
├── boxjs.json                BoxJS 订阅配置
└── README.md
```

---

## BoxJS 订阅

订阅链接：
```
https://raw.githubusercontent.com/1009394958/10086-checkin/main/boxjs.json
```

在 BoxJS 中订阅后可查看：`10086_cookie`、`10086_xtoken`、`10086_rtoken`、`10086_body_enc`、`10086_qwhd_cookie`、`10086_last_update`

---

## License

MIT
