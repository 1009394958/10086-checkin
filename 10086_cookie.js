// ==UserScript==
// @name         中国移动Cookie捕获
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.0.0
// @description  捕获中国移动App登录凭证
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动登录凭证捕获脚本
 * 
 * 【使用方法】
 * 1. 在 Quantumult X 中配置以下重写规则
 * 2. 打开中国移动App至首页，确保已登录
 * 3. 脚本会自动捕获Cookie、x-token等凭证
 * 
 * 【重写规则】
 * [rewrite_local]
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-response-body 10086_cookie.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-response-body 10086_cookie.js
 * ^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-response-body 10086_cookie.js
 * 
 * [mitm]
 * hostname = client.app.coc.10086.cn, clientaccess.10086.cn
 */

// ====================== 常量 ======================

const STORAGE_KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  RTOKEN: '10086_rtoken',
  XQEN: '10086_xqen',
  XSIGN: '10086_xsign',
  XNONCE: '10086_xnonce',
  XTIME: '10086_xtime',
  UID: '10086_uid',
  JSESSIONID: '10086_jsessionid',
  ENCRYPTED_BODY_AUTO: '10086_enc_body_auto',
  ENCRYPTED_BODY_TOKEN: '10086_enc_body_token',
  ENCRYPTED_BODY_USER: '10086_enc_body_user',
  LAST_UPDATE: '10086_last_update'
};

// ====================== 主函数 ======================

async function main() {
  if (typeof $request === 'undefined' || typeof $response === 'undefined') {
    console.log('此脚本仅用于Cookie捕获模式，请配置rewrite规则使用');
    $done();
    return;
  }
  
  const url = $request.url;
  const reqHeaders = $request.headers;
  const respHeaders = $response.headers;
  
  console.log('捕获请求:', url.split('?')[0]);
  
  let capturedItems = [];
  
  // 1. 捕获Cookie
  if (reqHeaders['Cookie']) {
    const cookie = reqHeaders['Cookie'];
    $prefs.setValueForKey(cookie, STORAGE_KEY.COOKIE);
    capturedItems.push('Cookie');
    
    // 提取UID
    const uidMatch = cookie.match(/UID=([^;]+)/);
    if (uidMatch) {
      $prefs.setValueForKey(uidMatch[1], STORAGE_KEY.UID);
      capturedItems.push('UID');
    }
    
    // 提取JSESSIONID
    const jsessionMatch = cookie.match(/JSESSIONID=([^;]+)/);
    if (jsessionMatch) {
      $prefs.setValueForKey(jsessionMatch[1], STORAGE_KEY.JSESSIONID);
    }
  }
  
  // 2. 捕获请求头中的x-token
  if (reqHeaders['x-token']) {
    $prefs.setValueForKey(reqHeaders['x-token'], STORAGE_KEY.XTOKEN);
    capturedItems.push('x-token');
  }
  
  // 3. 捕获请求头中的x-qen
  if (reqHeaders['x-qen']) {
    $prefs.setValueForKey(reqHeaders['x-qen'], STORAGE_KEY.XQEN);
  }
  
  // 4. 捕获请求头中的xs (签名)
  if (reqHeaders['xs']) {
    $prefs.setValueForKey(reqHeaders['xs'], STORAGE_KEY.XSIGN);
  }
  
  // 5. 捕获请求头中的x-nonce
  if (reqHeaders['x-nonce']) {
    $prefs.setValueForKey(reqHeaders['x-nonce'], STORAGE_KEY.XNONCE);
  }
  
  // 6. 捕获请求头中的x-time
  if (reqHeaders['x-time']) {
    $prefs.setValueForKey(reqHeaders['x-time'], STORAGE_KEY.XTIME);
  }
  
  // 7. 捕获响应头中的r-token（用于更新x-token）
  if (respHeaders['r-token']) {
    $prefs.setValueForKey(respHeaders['r-token'], STORAGE_KEY.RTOKEN);
    capturedItems.push('r-token');
  }
  
  // 8. 捕获加密请求体
  if ($request.body) {
    const body = typeof $request.body === 'string' ? $request.body : JSON.stringify($request.body);
    
    if (url.includes('autoLogin')) {
      $prefs.setValueForKey(body, STORAGE_KEY.ENCRYPTED_BODY_AUTO);
      capturedItems.push('autoLogin加密体');
    } else if (url.includes('getBigNetToken')) {
      $prefs.setValueForKey(body, STORAGE_KEY.ENCRYPTED_BODY_TOKEN);
      capturedItems.push('getBigNetToken加密体');
    } else if (url.includes('getUserInformation')) {
      $prefs.setValueForKey(body, STORAGE_KEY.ENCRYPTED_BODY_USER);
      capturedItems.push('getUserInformation加密体');
    }
  }
  
  // 更新时间戳
  $prefs.setValueForKey(Date.now().toString(), STORAGE_KEY.LAST_UPDATE);
  
  if (capturedItems.length > 0) {
    console.log('成功捕获:', capturedItems.join(', '));
    
    // 发送通知
    $notification.post(
      '中国移动 Cookie捕获',
      `成功捕获 ${capturedItems.length} 项凭证`,
      capturedItems.join(', ')
    );
  } else {
    console.log('未捕获到新的凭证数据');
  }
  
  $done();
}

main();