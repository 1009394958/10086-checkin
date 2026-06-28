// ==UserScript==
// @name         中国移动请求体捕获
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.0.0
// @description  捕获中国移动App的加密请求体（script-request-body模式）
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动加密请求体捕获脚本
 * 
 * 使用方式: script-request-body (请求体捕获)
 * 需要在Cookie捕获的基础上额外添加：
 * 
 * [rewrite_local]
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-request-body 10086_body.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-request-body 10086_body.js
 * ^https:\/\/client\.app\.coc\.10086\.cn\/leadeon-abilityopen-biz\/BN\/obtainToken\/getBigNetToken url script-request-body 10086_body.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/scoreQueryService\/getScoreQuery url script-request-body 10086_body.js
 */

// ====================== 常量 ======================

const STORAGE_KEY = {
  BODY_AUTO: '10086_body_auto',
  BODY_TOKEN: '10086_body_token',
  BODY_USER: '10086_body_user',
  BODY_SCORE: '10086_body_score',
  BODY_SIGN: '10086_body_sign',
  BODY_ENCRYPTED: '10086_body_enc'  // 通用加密体
};

// ====================== 主函数 ======================

function main() {
  if (typeof $request === 'undefined') {
    $done();
    return;
  }
  
  const url = $request.url || '';
  const body = $request.body || '';
  
  if (!body) {
    $done();
    return;
  }
  
  // 将body转为字符串
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  
  // 根据URL匹配，分类存储加密请求体
  let key = '';
  let label = '';
  
  if (url.includes('autoLogin')) {
    key = STORAGE_KEY.BODY_AUTO;
    label = 'autoLogin';
  } else if (url.includes('getBigNetToken')) {
    key = STORAGE_KEY.BODY_TOKEN;
    label = 'getBigNetToken';
  } else if (url.includes('getUserInformation')) {
    key = STORAGE_KEY.BODY_USER;
    label = 'getUserInformation';
  } else if (url.includes('getScoreQuery')) {
    key = STORAGE_KEY.BODY_SCORE;
    label = 'getScoreQuery';
  }
  
  if (key && bodyStr.length > 10) {
    $prefs.setValueForKey(bodyStr, key);
    // 同时存储一份通用加密体（供签到脚本使用）
    $prefs.setValueForKey(bodyStr, STORAGE_KEY.BODY_ENCRYPTED);
    console.log(`捕获加密请求体 [${label}]: ${bodyStr.length} bytes`);
  }
  
  $done();
}

main();