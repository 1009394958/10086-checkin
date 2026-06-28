/*
 * Quantumult X - 中国移动(10086) Token 采集脚本
 * 
 * 功能：
 *   1. 自动捕获 10086 App 的 x-token、r-token、Cookie 等关键凭证
 *   2. 捕获 咪咕视频 userToken、139云笔记 NOTE_TOKEN
 *   3. 持久化存储到 Quantumult X 的 $prefs 中
 *   4. 支持其他脚本通过 $prefs.valueForKey('10086_tokens') 读取
 *
 * 使用方式：
 *   [rewrite_local]
 *   ^https?:\/\/(.*\.)?(coc\.10086\.cn|10086\.cn|miguvideo\.com|139\.com|cmpassport\.com) url script-response-body 10086_token_harvester.js
 *   ^https?:\/\/(.*\.)?(coc\.10086\.cn|10086\.cn|miguvideo\.com|139\.com|cmpassport\.com) url script-request-header 10086_token_harvester.js
 *   ^https?:\/\/api\.miguvideo\.com\/user\/v1\/user-info url script-response-body 10086_token_harvester.js
 *   ^https?:\/\/note\.mcloud\.139\.com\/noteServer\/api\/authTokenRefresh url script-response-body 10086_token_harvester.js
 *
 *   [mitm]
 *   hostname = *.coc.10086.cn, *.10086.cn, *.miguvideo.com, *.139.com, *.cmpassport.com
 *
 * 注意：
 *   - 需要先打开一次 10086 App 并完成登录
 *   - 脚本会自动捕获流量中的 token 并持久化
 *   - 建议将脚本放在 Quantumult X 的 Scripts 目录下
 */

const VERSION = '1.0.0';
const KEY_TOKENS = '10086_tokens';
const KEY_COOKIES = '10086_cookies';
const KEY_MIGU_TOKEN = '10086_migu_token';
const KEY_NOTE_TOKEN = '10086_note_token';

/**
 * 读取持久化的 tokens
 */
function getStoredTokens() {
    try {
        const data = $prefs.valueForKey(KEY_TOKENS);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.log(`[10086 Token] 读取存储失败: ${e}`);
        return {};
    }
}

/**
 * 保存 tokens 到持久化存储
 */
function saveTokens(tokens) {
    try {
        $prefs.setValueForKey(JSON.stringify(tokens), KEY_TOKENS);
        console.log(`[10086 Token] Tokens 已保存`);
    } catch (e) {
        console.log(`[10086 Token] 保存失败: ${e}`);
    }
}

/**
 * 更新并保存指定 token
 */
function updateToken(key, value) {
    if (!value) return;
    const tokens = getStoredTokens();
    if (tokens[key] !== value) {
        tokens[key] = value;
        tokens['last_updated'] = new Date().toISOString();
        saveTokens(tokens);
        console.log(`[10086 Token] ✅ ${key} = ${value.substring(0, 30)}...`);
    }
}

/**
 * 从 Cookie 字符串中提取指定名称的值
 */
function extractCookieValue(cookieStr, name) {
    if (!cookieStr) return null;
    const regex = new RegExp(${name}=([^;]+));
    const match = cookieStr.match(regex);
    return match ? match[1] : null;
}

/**
 * 处理请求头 - 捕获 x-token 等
 */
function handleRequest() {
    const url = $request.url;
    const headers = $request.headers;

    console.log(`[10086 Token] 📤 请求: ${url.substring(0, 100)}`);

    // 捕获 x-token (主要认证 token)
    if (headers['x-token']) {
        updateToken('x_token', headers['x-token']);
    }

    // 捕获 Cookie 中的 JSESSIONID 和 UID
    if (headers['Cookie']) {
        const cookie = headers['Cookie'];
        const jsessionid = extractCookieValue(cookie, 'JSESSIONID');
        const uid = extractCookieValue(cookie, 'UID');

        if (jsessionid) updateToken('JSESSIONID', jsessionid);
        if (uid) updateToken('UID', uid);

        // 保存完整 Cookie
        try {
            $prefs.setValueForKey(cookie, KEY_COOKIES);
        } catch (e) {}
    }

    // 捕获 139 NOTE_TOKEN
    if (headers['NOTE_TOKEN']) {
        updateToken('NOTE_TOKEN', headers['NOTE_TOKEN']);
        try {
            $prefs.setValueForKey(headers['NOTE_TOKEN'], KEY_NOTE_TOKEN);
        } catch (e) {}
    }

    // 捕获 Migu userToken (请求头中)
    if (headers['userToken']) {
        updateToken('migu_userToken', headers['userToken']);
    }

    // 捕获 APP_AUTH Basic token
    if (headers['APP_AUTH']) {
        updateToken('APP_AUTH', headers['APP_AUTH']);
    }

    // 捕获 x-sign / x-nonce 等签名参数 (用于 debug)
    if (headers['x-sign']) updateToken('x_sign', headers['x-sign']);
    if (headers['x-nonce']) updateToken('x_nonce', headers['x-nonce']);
    if (headers['xs']) updateToken('xs', headers['xs']);
    if (headers['x-qen']) updateToken('x_qen', headers['x-qen']);
}

/**
 * 处理响应头 - 捕获 r-token、Set-Cookie 等
 */
function handleResponse() {
    const url = $request.url;
    const status = $response.status;
    const headers = $response.headers;

    console.log(`[10086 Token] 📥 响应: ${url.substring(0, 100)} [${status}]`);

    // 捕获 r-token (每个 API 响应头都有的 token)
    if (headers['r-token']) {
        updateToken('r_token', headers['r-token']);
    }

    // 捕获 Set-Cookie
    if (headers['Set-Cookie']) {
        const setCookie = headers['Set-Cookie'];
        const jsessionid = extractCookieValue(setCookie, 'JSESSIONID');
        const uid = extractCookieValue(setCookie, 'UID');

        if (jsessionid) updateToken('JSESSIONID', jsessionid);
        if (uid) updateToken('UID', uid);

        // 更新持久化的完整 Cookie
        let cookie = $prefs.valueForKey(KEY_COOKIES) || '';
        if (jsessionid) {
            cookie = cookie.replace(/JSESSIONID=[^;]+/, `JSESSIONID=${jsessionid}`);
            if (!cookie.includes('JSESSIONID')) {
                cookie = `JSESSIONID=${jsessionid}; ${cookie}`;
            }
        }
        if (uid) {
            cookie = cookie.replace(/UID=[^;]+/, `UID=${uid}`);
            if (!cookie.includes('UID')) {
                cookie = `UID=${uid}; ${cookie}`;
            }
        }
        try {
            $prefs.setValueForKey(cookie, KEY_COOKIES);
            updateToken('cookie', cookie);
        } catch (e) {}
    }

    // 处理响应体 - 尝试解析 JSON 提取 token
    if ($response.bodyBytes) {
        try {
            const bodyStr = typeof $response.bodyBytes === 'string'
                ? $response.bodyBytes
                : $text.utf8($response.bodyBytes);

            // 尝试解析 JSON 响应体
            if (bodyStr && bodyStr.startsWith('{')) {
                const body = JSON.parse(bodyStr);

                // 捕获 Migu video userToken
                if (body.userInfo && body.userInfo.userToken) {
                    updateToken('migu_userToken', body.userInfo.userToken);
                    updateToken('migu_userId', body.userInfo.userId);
                    updateToken('migu_mobile', body.userInfo.blurMobile || body.userInfo.mobile);
                    updateToken('migu_passId', body.userInfo.passId);

                    // 保存到独立 key
                    const miguData = {
                        userToken: body.userInfo.userToken,
                        userId: body.userInfo.userId,
                        mobile: body.userInfo.blurMobile || body.userInfo.mobile,
                        expiredOn: body.userInfo.expiredOn,
                        passId: body.userInfo.passId
                    };
                    try {
                        $prefs.setValueForKey(JSON.stringify(miguData), KEY_MIGU_TOKEN);
                    } catch (e) {}

                    // 通知用户
                    const now = new Date();
                    const expireDate = body.userInfo.expiredOn
                        ? new Date(parseInt(body.userInfo.expiredOn))
                        : '未知';
                    $notification.post(
                        '✅ 10086 Token 已捕获',
                        `咪咕 userToken 已更新`,
                        `有效期至: ${expireDate}`
                    );
                }

                // 捕获其他可能的 token 字段
                if (body.accessToken) updateToken('accessToken', body.accessToken);
                if (body.refreshToken) updateToken('refreshToken', body.refreshToken);
                if (body.token) updateToken('token', body.token);

                // 捕获 resultCode
                if (body.resultCode) {
                    updateToken('last_resultCode', body.resultCode);
                }
            }
        } catch (e) {
            // JSON 解析失败是正常的(加密body)
        }
    }
}

/**
 * 输出当前所有 tokens 的摘要
 */
function logTokensSummary() {
    const tokens = getStoredTokens();
    const summary = Object.entries(tokens)
        .filter(([k]) => !['x_sign', 'x_nonce', 'xs', 'x_qen', 'last_resultCode'].includes(k))
        .map(([k, v]) => {
            const val = typeof v === 'string' && v.length > 40 ? v.substring(0, 40) + '...' : v;
            return `  ${k}: ${val}`;
        })
        .join('\n');

    console.log(`[10086 Token] 📋 当前 Tokens:\n${summary || '  无'}`);
    console.log(`[10086 Token] 🔑 Cookie: ${(tokens.cookie || '').substring(0, 60)}...`);
}

// ====== 主入口 ======

// 判断脚本运行类型
const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined';
const isResponse = typeof $request !== 'undefined' && typeof $response !== 'undefined';

if (isRequest) {
    // 请求阶段 - 从请求头捕获 tokens
    handleRequest();
    $done({});
} else if (isResponse) {
    // 响应阶段 - 从响应头和响应体捕获 tokens
    handleResponse();
    logTokensSummary();
    $done($response);
} else {
    // 手动执行模式 - 输出所有存储的 tokens
    const tokens = getStoredTokens();
    const miguData = (() => {
        try {
            return JSON.parse($prefs.valueForKey(KEY_MIGU_TOKEN) || '{}');
        } catch (e) { return {}; }
    })();
    const cookie = $prefs.valueForKey(KEY_COOKIES) || '';

    // 构建可读的输出
    let output = '===== 10086 Tokens 汇总 =====\n\n';

    output += '--- 主认证 ---\n';
    output += `x-token:         ${(tokens.x_token || '未捕获').substring(0, 50)}...\n`;
    output += `r-token:         ${tokens.r_token || '未捕获'}\n`;
    output += `JSESSIONID:      ${tokens.JSESSIONID || '未捕获'}\n`;
    output += `UID:             ${tokens.UID || '未捕获'}\n\n`;

    output += '--- 咪咕视频 ---\n';
    output += `userToken:       ${miguData.userToken || tokens.migu_userToken || '未捕获'}\n`;
    output += `userId:          ${miguData.userId || tokens.migu_userId || '未捕获'}\n`;
    output += `手机号:          ${miguData.mobile || tokens.migu_mobile || '未捕获'}\n`;
    output += `passId:          ${miguData.passId || tokens.migu_passId || '未捕获'}\n`;
    output += `过期时间:        ${miguData.expiredOn ? new Date(parseInt(miguData.expiredOn)).toLocaleString() : '未捕获'}\n\n`;

    output += '--- 139云笔记 ---\n';
    output += `NOTE_TOKEN:      ${(tokens.NOTE_TOKEN || '未捕获').substring(0, 50)}...\n\n`;

    output += '--- Cookie ---\n';
    output += `${cookie || '未捕获'}\n\n`;

    output += `最后更新: ${tokens.last_updated || '未知'}\n`;

    console.log(output);
    $done({
        action: 'pref_get',
        key: KEY_TOKENS
    });
}

/*
 * 示例：在其他 Quantumult X 脚本中读取 token
 *
 * const tokenData = JSON.parse($prefs.valueForKey('10086_tokens') || '{}');
 * const miguData = JSON.parse($prefs.valueForKey('10086_migu_token') || '{}');
 * const cookie = $prefs.valueForKey('10086_cookies');
 *
 * const xToken = tokenData.x_token;
 * const userToken = miguData.userToken;
 * const jsessionid = tokenData.JSESSIONID;
 * const uid = tokenData.UID;
 */