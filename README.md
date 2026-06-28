# 中国移动每日签到 (Quantumult X)

> 基于 Quantumult X 的中国移动 App 每日自动签到脚本

## 功能

- 自动捕获中国移动App登录凭证（Cookie、x-token）
- 自动捕获加密请求体
- 每日定时签到
- 签到结果系统通知

## 使用前提

1. iOS 设备已安装 [Quantumult X](https://apps.apple.com/app/quantumult-x/id1443988620)
2. 已安装中国移动 App 并成功登录
3. 已在 Quantumult X 中配置 MITM 证书

## 文件说明

| 文件 | 模式 | 功能 |
|------|------|------|
| `10086_cookie.js` | `script-request-header` | 捕获Cookie和x-token（无阻塞）|
| `10086_body.js` | `script-request-body` | 捕获加密请求体 |
| `10086_checkin.js` | `task_local` | 定时执行签到 |
| `boxjs.json` | BoxJS | 面板管理登录状态 |
| `config/quantumultx.conf` | 配置模板 | 完整配置参考 |

## 安装步骤

### 1. 将脚本保存到本地

将以下脚本文件下载到 Quantumult X 的 Scripts 文件夹：
- [10086_cookie.js](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_cookie.js)
- [10086_body.js](https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_body.js)

> **注意**: 推荐使用本地脚本（将文件保存到 `Quantumult X/Scripts/` 目录），避免远程加载超时。

### 2. 添加Quantumult X配置

```ini
[rewrite_local]
; ========== Cookie/Token 捕获（请求头模式，无阻塞）==========
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_cookie.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_cookie.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_cookie.js

; ========== 加密请求体捕获（请求体模式）==========
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-body 10086_body.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-body 10086_body.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-body 10086_body.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-body 10086_body.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true

[mitm]
hostname = client.app.coc.10086.cn, clientaccess.10086.cn
```

### 3. 捕获登录凭证

1. 确保 Quantumult X 已开启（VPN 连接状态）
2. **打开中国移动 App**
3. 正常使用App，等待弹窗提示 "Cookie/Token 捕获成功"
4. 首次捕获成功后即可关闭 App

### 4. 验证签到

- 打开 Quantumult X → 「设置」→「构造请求」→「任务」
- 找到「中国移动签到」，点击运行
- 查看日志确认执行结果

## 技术原理

中国移动 App 的 API 使用自定义加密协议，所有请求体经过加密传输。

### 请求头鉴权体系

| 请求头 | 说明 |
|--------|------|
| `x-qen` | 加密协议版本（常见值: 14, 2）|
| `x-sign` | 请求签名（MD5格式）|
| `x-nonce` | 8位随机数 |
| `x-token` | 用户令牌（每次响应通过`r-token`头轮换）|
| `x-time` | 13位时间戳 |
| `xs` | 校验参数 |

### 三脚本协作流程

```
1. 10086_cookie.js (request-header)
   └─ 拦截请求头，捕获 Cookie + x-token → 存入 $prefs

2. 10086_body.js (request-body)
   └─ 拦截请求体，捕获 加密body → 存入 $prefs

3. 10086_checkin.js (task_local)
   └─ 读取 $prefs 中的凭证，请求体重放 → 完成签到
```

> 由于加密算法未公开，脚本采用"请求体重放"策略，
> 即原样发送从 App 捕获的加密请求体。

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| `timeout` 错误 | 远程脚本加载超时 | 将脚本下载到本地使用 |
| 未捕获到凭证 | MITM证书未信任 | 检查Quantumult X的MITM配置 |
| 缺少加密请求体 | body脚本未触发 | 重新打开中国移动App |

## License

MIT
