// ==UserScript==
// @name         中国移动统一捕获（Cookie + 加密体 + 余额查询）
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.1.0
// @description  统一捕获中国移动App的Cookie/Token/加密请求体/余额API
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动统一捕获脚本 v1.1
 *
 * 兼容三种 rewrite 模式：
 *   script-request-header → 捕获Cookie、x-token
 *   script-request-body   → 捕获加密请求体
 *   script-response-body  → 捕获响应头r-token
 *
 * [rewrite_local] 配置：
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_capture.js
 * ^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/realFeeQuery\/getRealFee url script-request-header 10086_capture.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BH\/newPlanRemainQry\/getNewPlanRemainQry url script-request-header 10086_capture.js
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
  BODY_ENC: '10086_body_enc',
  QWHD_COOKIE: '10086_qwhd_cookie'
};

function main() {
  if (typeof $request === 'undefined') {
    $done(); return;
  }

  const url = $request.url || '';
  const headers = $request.headers || {};
  const shortUrl = url.split(/[?#]/)[0].substring(0, 80);
  
  console.log('捕获: ' + shortUrl);

  let captured = [];

  // ── 捕获 Cookie ──
  const cookie = headers['Cookie'] || '';
  if (cookie) {
    $prefs.setValueForKey(cookie, KEY.COOKIE);
    captured.push('Cookie(' + cookie.length + 'B)');
    const uid = cookie.match(/UID=([^;]+)/);
    if (uid) $prefs.setValueForKey(uid[1], KEY.UID);
  }

  // ── 捕获 x-token / x-qen ──
  if (headers['x-token']) {
    $prefs.setValueForKey(headers['x-token'], KEY.XTOKEN);
    captured.push('x-token');
  }
  if (headers['x-qen']) $prefs.setValueForKey(headers['x-qen'], KEY.XQEN);

  // ── 捕获请求体（script-request-body 模式）──
  const body = getBody();
  if (body && body.length > 10) {
    $prefs.setValueForKey(body, KEY.BODY_ENC);
    captured.push('加密体(' + body.length + 'B)');
  }

  // ── 捕获 r-token（script-response-body 模式）──
  if (typeof $response !== 'undefined') {
    const rtoken = ($response.headers || {})['r-token'];
    if (rtoken) {
      $prefs.setValueForKey(rtoken, KEY.RTOKEN);
      $prefs.setValueForKey(rtoken, KEY.XTOKEN);
      captured.push('r-token(已更新x-token)');
    }
    const sc = ($response.headers || {})['Set-Cookie'] || ($response.headers || {})['set-cookie'] || '';
    if (sc) $prefs.setValueForKey(sc, KEY.COOKIE);
  }

  // ── 捕获 QWHD Cookie ──
  if (url.includes('wx.10086.cn') && cookie.includes('QWHD')) {
    $prefs.setValueForKey(cookie, KEY.QWHD_COOKIE);
    captured.push('QWHD');
  }

  if (captured.length > 0) {
    console.log('✓ 成功捕获: ' + captured.join(', '));
    if (url.includes('autoLogin') || url.includes('getUserInformation')) {
      try {
        $notification.post(
          '中国移动 捕获成功',
          captured.join(', '),
          new Date().toLocaleString('zh-CN', { hour12: false })
        );
      } catch(e) {}
    }
  }

  $done();
}

function getBody() {
  try {
    if (!$request.body && !$request.bodyBytes) return null;
    let raw = $request.body || $request.bodyBytes || '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      try { return JSON.stringify(raw); } catch(e) {}
    }
    if (raw instanceof ArrayBuffer || raw instanceof Uint8Array || Array.isArray(raw)) {
      try {
        const bytes = new Uint8Array(raw);
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return str;
      } catch(e) {}
    }
    return String(raw);
  } catch(e) {
    return null;
  }
}

main();