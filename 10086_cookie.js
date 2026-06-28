// ==UserScript==
// @name         中国移动Cookie捕获
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.1.0
// @description  捕获中国移动App登录凭证（请求头模式，无阻塞）
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动登录凭证捕获脚本
 * 
 * 使用方式: script-request-header (请求头捕获，无阻塞)
 * 在 Quantumult X 配置中添加：
 * 
 * [rewrite_local]
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-header 10086_cookie.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-header 10086_cookie.js
 * ^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-header 10086_cookie.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-header 10086_cookie.js
 * 
 * [mitm]
 * hostname = client.app.coc.10086.cn, clientaccess.10086.cn
 */

// ====================== 常量 ======================

const STORAGE_KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  XQEN: '10086_xqen',
  UID: '10086_uid',
  JSESSIONID: '10086_jsessionid',
  LAST_UPDATE: '10086_last_update'
};

// ====================== 主函数 ======================

async function main() {
  if (typeof $request === 'undefined') {
    console.log('此脚本仅用于rewrite模式');
    $done();
    return;
  }
  
  const url = $request.url || '';
  const headers = $request.headers || {};
  
  console.log('捕获请求:', (url.split('?')[0] || url).substring(0, 80));
  
  let capturedItems = [];
  
  // 1. 捕获Cookie（从请求头）
  const cookie = headers['Cookie'] || '';
  if (cookie) {
    $prefs.setValueForKey(cookie, STORAGE_KEY.COOKIE);
    capturedItems.push('Cookie');
    
    const uidMatch = cookie.match(/UID=([^;]+)/);
    if (uidMatch) {
      $prefs.setValueForKey(uidMatch[1], STORAGE_KEY.UID);
      capturedItems.push('UID:' + uidMatch[1].substring(0, 8) + '...');
    }
    
    const jsessionMatch = cookie.match(/JSESSIONID=([^;]+)/);
    if (jsessionMatch) {
      $prefs.setValueForKey(jsessionMatch[1], STORAGE_KEY.JSESSIONID);
    }
  }
  
  // 2. 捕获x-token（从请求头）
  const xtoken = headers['x-token'] || '';
  if (xtoken) {
    $prefs.setValueForKey(xtoken, STORAGE_KEY.XTOKEN);
    capturedItems.push('x-token');
  }
  
  // 3. 捕获x-qen
  const xqen = headers['x-qen'] || '';
  if (xqen) {
    $prefs.setValueForKey(xqen, STORAGE_KEY.XQEN);
    capturedItems.push('x-qen:' + xqen);
  }
  
  // 更新时间戳
  const now = Date.now();
  $prefs.setValueForKey(now.toString(), STORAGE_KEY.LAST_UPDATE);
  
  if (capturedItems.length > 0) {
    const summary = capturedItems.join(', ');
    console.log('成功捕获:', summary);
    
    // 只在关键接口捕获时发送通知（autoLogin 或 getUserInformation）
    if (url.includes('autoLogin')) {
      const timeStr = new Date(now).toLocaleString('zh-CN', { hour12: false });
      $notification.post(
        '中国移动 签到',
        'Cookie/Token 捕获成功',
        timeStr + ' | ' + summary
      );
    }
  } else {
    console.log('未捕获到凭证数据');
  }
  
  // script-request-header 模式直接放行
  $done();
}

main();