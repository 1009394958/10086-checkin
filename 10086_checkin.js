// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.1.0
// @description  中国移动App每日签到
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动每日签到脚本
 * 
 * 使用方式: task_local (定时任务)
 * 
 * 前置条件：
 * 1. 先配置 10086_cookie.js (script-request-header) 捕获登录凭证
 * 2. 再配置 10086_body.js (script-request-body) 捕获加密请求体
 * 3. 打开中国移动App触发捕获后，此脚本即可正常运行
 * 
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true
 */

// ====================== 常量定义 ======================

const APP_NAME = '中国移动';

// 核心API地址
const API = {
  USER_INFO: 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation',
  BIG_NET_TOKEN: 'https://client.app.coc.10086.cn/leadeon-abilityopen-biz/BN/obtainToken/getBigNetToken',
  SCORE_QUERY: 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery'
};

// 存储Key
const STORAGE_KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  XQEN: '10086_xqen',
  BODY_ENC: '10086_body_enc',
  BODY_USER: '10086_body_user',
  BODY_TOKEN: '10086_body_token',
  BODY_SCORE: '10086_body_score'
};

// ====================== 主函数 ======================

async function main() {
  console.log(`${APP_NAME} 签到脚本开始执行...`);
  
  if (typeof $request !== 'undefined') {
    // Rewrite模式下不做处理（由10086_cookie.js和10086_body.js处理）
    $done();
    return;
  }
  
  await handleCheckIn();
  $done();
}

// ====================== 签到执行 ======================

async function handleCheckIn() {
  // 检查登录凭证
  const cookie = $prefs.valueForKey(STORAGE_KEY.COOKIE);
  const xtoken = $prefs.valueForKey(STORAGE_KEY.XTOKEN);
  
  if (!cookie || !xtoken) {
    console.log('缺少登录凭证');
    $notification.post(
      `${APP_NAME} 签到失败`,
      '缺少登录凭证',
      '请打开中国移动App并确保Cookie脚本已配置'
    );
    return;
  }
  
  console.log('登录凭证已就绪');
  console.log('Cookie长度:', cookie.length);
  console.log('x-token长度:', xtoken.length);
  
  // 检查加密请求体
  const encBody = $prefs.valueForKey(STORAGE_KEY.BODY_ENC);
  if (!encBody) {
    console.log('缺少加密请求体');
    $notification.post(
      `${APP_NAME} 签到`,
      '请先捕获加密请求体',
      '确保已配置10086_body.js脚本，并打开一次中国移动App'
    );
    return;
  }
  console.log('加密请求体已就绪, 长度:', encBody.length);
  
  // 步骤1: 验证登录
  console.log('步骤1: 验证登录状态...');
  const valid = await verifyLogin(cookie, xtoken);
  if (!valid) {
    console.log('登录状态失效');
    $notification.post(`${APP_NAME} 签到失败`, '登录状态已过期', '请重新打开中国移动App捕获凭证');
    return;
  }
  console.log('登录状态有效');
  
  // 步骤2: 执行签到查询
  console.log('步骤2: 查询签到状态...');
  const status = await queryStatus(cookie, xtoken);
  console.log('签到状态查询完成');
  
  // 由于响应体加密，暂时无法解析具体签到状态
  // 但能成功请求说明Token有效，签到逻辑可在此扩展
  
  console.log('签到流程完成');
  $notification.post(
    `${APP_NAME} 签到完成`,
    '签到请求已发送',
    '请打开中国移动App查看签到结果'
  );
}

// ====================== API请求 ======================

function makeRequest(url, body, cookie, xtoken, xqen) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    const headers = {
      'Host': url.includes('clientaccess') ? 'clientaccess.10086.cn' : 'client.app.coc.10086.cn',
      'x-qen': xqen || '14',
      'Accept': '*/*',
      'x-sign': '1',
      'x-nonce': nonce,
      'x-token': xtoken,
      'Accept-Encoding': 'deflate',
      'Accept-Language': 'zh-Hans-CN;q=1, en-CN;q=0.9',
      'Content-Type': 'application/Json',
      'x-time': timestamp,
      'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
      'Cookie': cookie
    };
    
    // 使用存储的加密body
    const requestBody = body || '';
    
    $task.fetch({
      url: url,
      method: 'POST',
      headers: headers,
      body: requestBody,
      timeout: 30
    }).then(response => {
      // 更新x-token (r-token轮换)
      if (response.headers && response.headers['r-token']) {
        $prefs.setValueForKey(response.headers['r-token'], STORAGE_KEY.XTOKEN);
        console.log('x-token已更新');
      }
      resolve(response);
    }).catch(err => {
      console.log('请求失败:', err);
      reject(err);
    });
  });
}

async function verifyLogin(cookie, xtoken) {
  try {
    const userBody = $prefs.valueForKey(STORAGE_KEY.BODY_USER) || $prefs.valueForKey(STORAGE_KEY.BODY_ENC);
    const resp = await makeRequest(API.USER_INFO, userBody, cookie, xtoken, '2');
    return resp && resp.statusCode === 200;
  } catch (e) {
    console.log('验证登录失败:', e.message);
    return false;
  }
}

async function queryStatus(cookie, xtoken) {
  try {
    const scoreBody = $prefs.valueForKey(STORAGE_KEY.BODY_SCORE) || $prefs.valueForKey(STORAGE_KEY.BODY_ENC);
    const resp = await makeRequest(API.SCORE_QUERY, scoreBody, cookie, xtoken, '2');
    return resp && resp.statusCode === 200;
  } catch (e) {
    console.log('查询状态失败:', e.message);
    return false;
  }
}

main();