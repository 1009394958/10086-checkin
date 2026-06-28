// ==UserScript==
// @name         中国移动统一捕获（Cookie + 加密体）
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.0.0
// @description  统一捕获中国移动App的Cookie/Token和加密请求体（兼容所有rewrite模式）
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动统一捕获脚本
 *
 * 兼容三种 rewrite 模式：
 *   script-request-header → 捕获Cookie、x-token（无阻塞）
 *   script-request-body   → 捕获加密请求体
 *   script-response-body  → 捕获响应头r-token
 *
 * 使用方法（替换之前的10086_cookie.js + 10086_body.js）：
 *
 * [rewrite_local]
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_capture.js
 * ^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-header 10086_capture.js
 *
 * [mitm]
 * hostname = client.app.coc.10086.cn, clientaccess.10086.cn, wx.10086.cn
 */

const KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  XQEN: '10086_xqen',
  UID: '10086_uid',
  RTOKEN: '10086_rtoken',
  BODY_ENC: '10086_body_enc',  // 通用加密体
  QWHD_COOKIE: '10086_qwhd_cookie'
};

function main() {
  if (typeof $request === 'undefined') {
    console.log('捕获脚本: 缺少$request，跳过');
    $done();
    return;
  }

  const url = $request.url || '';
  const headers = $request.headers || {};
  
  console.log('捕获脚本触发: ' + url.split(/[?#]/)[0].substring(0, 80));
  console.log('运行模式: ' + getMode());

  let captured = [];

  // ── 模式1: script-request-header → 捕获请求头中的凭证 ──
  if (headers['Cookie']) {
    const cookie = headers['Cookie'];
    $prefs.setValueForKey(cookie, KEY.COOKIE);
    captured.push('Cookie(' + cookie.length + 'B)');
    
    const uidMatch = cookie.match(/UID=([^;]+)/);
    if (uidMatch) {
      $prefs.setValueForKey(uidMatch[1], KEY.UID);
    }
  }

  if (headers['x-token']) {
    $prefs.setValueForKey(headers['x-token'], KEY.XTOKEN);
    captured.push('x-token');
  }

  if (headers['x-qen']) {
    $prefs.setValueForKey(headers['x-qen'], KEY.XQEN);
  }

  // ── 模式2: script-request-body → 捕获请求体 ──
  const body = getBody();
  if (body && body.length > 10) {
    $prefs.setValueForKey(body, KEY.BODY_ENC);
    captured.push('加密体(' + body.length + 'B)');
    console.log('捕获到加密请求体: ' + body.substring(0, 40) + '...');
  } else if (body) {
    console.log('请求体过短(' + (body.length || 0) + 'B)，不存储');
  }

  // ── 模式3: script-response-body → 捕获响应头r-token ──
  if (typeof $response !== 'undefined' && $response.headers) {
    const rtoken = $response.headers['r-token'];
    if (rtoken) {
      $prefs.setValueForKey(rtoken, KEY.RTOKEN);
      // 同时更新x-token
      $prefs.setValueForKey(rtoken, KEY.XTOKEN);
      captured.push('r-token(已更新x-token)');
    }
    
    // 捕获Set-Cookie
    const setCookie = $response.headers['Set-Cookie'];
    if (setCookie) {
      $prefs.setValueForKey(setCookie, KEY.COOKIE);
      captured.push('Set-Cookie(已更新)');
    }
  }

  // ── 额外: 捕获QWHD Cookie (wx.10086.cn) ──
  if (url.includes('wx.10086.cn')) {
    const cookie = headers['Cookie'] || '';
    if (cookie && cookie.includes('QWHD')) {
      $prefs.setValueForKey(cookie, KEY.QWHD_COOKIE);
      captured.push('QWHD_Cookie');
    }
    // 尝试从响应头Set-Cookie捕获
    if (typeof $response !== 'undefined' && $response.headers) {
      const sc = $response.headers['Set-Cookie'] || $response.headers['set-cookie'] || '';
      if (sc && sc.includes('QWHD')) {
        $prefs.setValueForKey(sc, KEY.QWHD_COOKIE);
        captured.push('QWHD_Set-Cookie');
      }
    }
  }

  // ── 输出结果 ──
  if (captured.length > 0) {
    console.log('✓ 成功捕获: ' + captured.join(', '));
    
    // 仅在关键接口通知
    if (url.includes('autoLogin') || url.includes('getUserInformation')) {
      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      try {
        $notification.post(
          '中国移动 捕获成功',
          captured.join(', '),
          now
        );
      } catch(e) {}
    }
  } else {
    console.log('- 本次无新数据捕获');
  }

  $done();
}

/** 检测当前运行模式 */
function getMode() {
  if (typeof $response !== 'undefined') return 'script-response-body';
  const body = getBody();
  if (body) return 'script-request-body';
  return 'script-request-header';
}

/** 安全获取请求体 */
function getBody() {
  try {
    if (!$request.body && !$request.bodyBytes) return null;
    
    let raw = $request.body || $request.bodyBytes || '';
    
    if (typeof raw === 'string') return raw;
    
    // 如果是对象，尝试JSON序列化
    if (typeof raw === 'object') {
      try { return JSON.stringify(raw); } catch(e) {}
    }
    
    // 如果是ArrayBuffer/Uint8Array
    if (raw instanceof ArrayBuffer || raw instanceof Uint8Array || Array.isArray(raw)) {
      try {
        const bytes = new Uint8Array(raw);
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i]);
        }
        return str;
      } catch(e) {}
    }
    
    return String(raw);
  } catch(e) {
    console.log('getBody异常:', e.message);
    return null;
  }
}

main();