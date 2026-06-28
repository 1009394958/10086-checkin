# 中国移动每日签到 (Quantumult X)

> 基于 Quantumult X 的中国移动 App 每日自动签到脚本

## 功能

- 自动捕获中国移动App登录凭证（Cookie、x-token）
- 每日定时签到
- 幸运转转转抽奖活动支持（活动ID: 1021122301）
- 签到结果系统通知
- BoxJS 面板管理登录状态

## 使用前提

1. iOS 设备已安装 [Quantumult X](https://apps.apple.com/app/quantumult-x/id1443988620)
2. 已安装中国移动 App 并成功登录
3. 已在 Quantumult X 中配置 MITM 证书

## 安装步骤

### 1. 添加配置引用

在 Quantumult X 的配置文件中添加以下内容：

```ini
[rewrite_local]
^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_cookie.js
^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_cookie.js
^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_cookie.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true

[mitm]
hostname = client.app.coc.10086.cn, clientaccess.10086.cn
```

### 2. 捕获登录凭证

1. 确保 Quantumult X 已开启（VPN 连接状态）
2. 打开中国移动 App
3. 等待弹窗提示 "成功捕获 N 项凭证"
4. 首次捕获成功后即可关闭 App

### 3. 验证签到

在 Quantumult X 中手动运行签到任务：
- 打开 Quantumult X
- 进入「设置」→「构造请求」→「任务」
- 找到「中国移动签到」，点击运行

## 文件说明

| 文件 | 说明 |
|------|------|
| `10086_cookie.js` | 登录凭证捕获脚本（rewrite模式） |
| `10086_checkin.js` | 签到执行脚本（task模式） |
| `boxjs.json` | BoxJS 面板配置 |
| `config/quantumultx.conf` | Quantumult X 配置模板 |

## 技术说明

> **重要**: 中国移动 App 的 API 使用自定义加密协议，所有请求体经过加密传输。
> 
> 请求头包含以下自定义字段用于鉴权和防篡改：
> - `x-qen`: 加密协议版本
> - `x-sign`: 请求签名
> - `x-nonce`: 随机数
> - `x-token`: 用户令牌（每次响应通过 `r-token` 头轮换）
> - `x-time`: 时间戳
> - `xs`: 校验参数
>
> 由于加密算法未公开，脚本需要捕获真实的加密请求体进行重放。
> 如果签到失败，请重新捕获 Cookie 和 Token。

## HAR 数据分析

- **抓包工具**: Quantumult X v1.6.0
- **App版本**: 中国移动 v12.1.2 (iOS)
- **签到活动**: 签到有礼（activityId: 1021122301）
- **核心API域名**: `client.app.coc.10086.cn`, `clientaccess.10086.cn`

## License

MIT
