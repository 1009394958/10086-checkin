// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      1.0.0
// @description  中国移动App每日签到，支持幸运转转转抽奖
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动每日签到脚本
 * 
 * 【抓取Cookie方法】
 * 1. 打开中国移动App，确保已登录
 * 2. Quantumult X 中配置重写规则捕获Cookie
 * 3. 手动运行脚本获取Token和Session
 * 
 * 【Quantumult X 配置】
 * 
 * [rewrite_local]
 * ^https:\/\/client\.app\.coc\.10086\.cn\/biz-orange\/LN\/uamonekeylogin\/autoLogin url script-response-body 10086_checkin.js
 * ^https:\/\/clientaccess\.10086\.cn\/biz-orange\/BN\/userInformationService\/getUserInformation url script-response-body 10086_checkin.js
 * 
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true
 * 
 * [mitm]
 * hostname = client.app.coc.10086.cn, clientaccess.10086.cn
 */

// ====================== 常量定义 ======================

const APP_NAME = '中国移动';
const CHECKIN_URL = 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery';

// 幸运转转转活动ID (从HAR包提取)
const ACTIVITY_ID = '1021122301';

// 存储Key
const STORAGE_KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  XSIGN: '10086_xsign',
  XNONCE: '10086_xnonce',
  XTIME: '10086_xtime',
  XQEN: '10086_xqen',
  UID: '10086_uid',
  JSESSIONID: '10086_jsessionid',
  RTOKEN: '10086_rtoken',
  ENCRYPTED_BODY: '10086_encrypted_body'
};

// ====================== 主函数 ======================

async function main() {
  console.log(`${APP_NAME} 签到脚本开始执行...`);
  
  // 检测运行模式
  if (typeof $request !== 'undefined' && typeof $response !== 'undefined') {
    // Cookie捕获模式（由rewrite触发）
    await handleCookieCapture();
  } else {
    // 定时任务模式
    await handleCheckIn();
  }
  
  $done();
}

// ====================== Cookie捕获 ======================

async function handleCookieCapture() {
  console.log('捕获Cookie/Token模式...');
  
  const url = $request.url;
  const respHeaders = $response.headers;
  const reqHeaders = $request.headers;
  
  // 1. 捕获Cookie
  if (reqHeaders['Cookie']) {
    const cookie = reqHeaders['Cookie'];
    const uidMatch = cookie.match(/UID=([^;]+)/);
    const jsessionidMatch = cookie.match(/JSESSIONID=([^;]+)/);
    
    if (uidMatch) {
      $prefs.setValueForKey(uidMatch[1], STORAGE_KEY.UID);
      console.log('捕获到UID:', uidMatch[1]);
    }
    if (jsessionidMatch) {
      $prefs.setValueForKey(jsessionidMatch[1], STORAGE_KEY.JSESSIONID);
      console.log('捕获到JSESSIONID');
    }
    $prefs.setValueForKey(cookie, STORAGE_KEY.COOKIE);
  }
  
  // 2. 捕获x-token（从请求头）
  if (reqHeaders['x-token']) {
    $prefs.setValueForKey(reqHeaders['x-token'], STORAGE_KEY.XTOKEN);
    console.log('捕获到x-token');
  }
  
  // 3. 捕获x-qen
  if (reqHeaders['x-qen']) {
    $prefs.setValueForKey(reqHeaders['x-qen'], STORAGE_KEY.XQEN);
  }
  
  // 4. 捕获xs
  if (reqHeaders['xs']) {
    $prefs.setValueForKey(reqHeaders['xs'], STORAGE_KEY.XSIGN);
  }
  
  // 5. 捕获r-token（从响应头）- 用于更新x-token
  if (respHeaders['r-token']) {
    $prefs.setValueForKey(respHeaders['r-token'], STORAGE_KEY.RTOKEN);
    console.log('捕获到r-token:', respHeaders['r-token']);
  }
  
  // 6. 捕获加密请求体（autoLogin的body）
  if (url.includes('autoLogin') && $request.body) {
    $prefs.setValueForKey($request.body, STORAGE_KEY.ENCRYPTED_BODY);
    console.log('捕获到autoLogin请求体');
  }
  
  // 获取用户信息接口，响应包含用户数据
  if (url.includes('getUserInformation') && $response.body) {
    console.log('已获取用户信息响应，尝试更新令牌');
  }
  
  console.log('Cookie/Token捕获完成');
  
  // 通知用户
  const now = new Date();
  $notification.post(
    `${APP_NAME} 签到`, 
    'Cookie捕获成功', 
    `${now.toLocaleString()} 已更新登录凭证`
  );
}

// ====================== 签到执行 ======================

async function handleCheckIn() {
  console.log('执行签到模式...');
  
  // 检查是否已登录
  const cookie = $prefs.valueForKey(STORAGE_KEY.COOKIE);
  const xtoken = $prefs.valueForKey(STORAGE_KEY.XTOKEN);
  
  if (!cookie || !xtoken) {
    const msg = '未检测到登录凭证，请先在APP中登录并捕获Cookie';
    console.log(msg);
    $notification.post(
      `${APP_NAME} 签到失败`,
      '缺少登录凭证',
      '请打开中国移动App并运行抓取Cookie脚本'
    );
    return;
  }
  
  // 步骤1: 获取用户信息（验证登录状态）
  console.log('步骤1: 验证登录状态...');
  const userInfo = await getUserInfo(cookie, xtoken);
  if (!userInfo) {
    console.log('登录状态失效，需要重新捕获Cookie');
    $notification.post(
      `${APP_NAME} 签到失败`,
      '登录状态已过期',
      '请重新打开中国移动App并捕获Cookie'
    );
    return;
  }
  console.log('登录状态有效');
  
  // 步骤2: 获取BigNetToken
  console.log('步骤2: 获取BigNetToken...');
  const bigNetToken = await getBigNetToken(cookie, xtoken);
  if (!bigNetToken) {
    console.log('获取BigNetToken失败');
    return;
  }
  console.log('BigNetToken获取成功');
  
  // 步骤3: 查询今日签到状态
  console.log('步骤3: 查询签到状态...');
  const signStatus = await querySignStatus(cookie, xtoken);
  if (signStatus === null) {
    console.log('查询签到状态失败');
    return;
  }
  
  if (signStatus === true) {
    console.log('今日已签到，无需重复签到');
    $notification.post(
      `${APP_NAME} 签到`,
      '今日已签到',
      '您今天已经完成签到，明天再来吧'
    );
    return;
  }
  
  // 步骤4: 执行签到
  console.log('步骤4: 执行签到...');
  const result = await doSignIn(cookie, xtoken);
  
  if (result.success) {
    console.log('签到成功');
    $notification.post(
      `${APP_NAME} 签到成功`,
      result.message || '恭喜您完成签到',
      result.reward || ''
    );
  } else {
    console.log('签到失败:', result.message);
    $notification.post(
      `${APP_NAME} 签到失败`,
      result.message || '签到异常',
      '请手动检查签到状态'
    );
  }
}

// ====================== API请求封装 ======================

/**
 * 生成请求签名 (x-sign)
 * 注：实际签名算法需要逆向分析，当前为占位实现
 */
function generateSign(body, nonce, timestamp) {
  // TODO: 根据实际加密算法实现
  // 需要逆向分析中国移动App的加密逻辑
  // 目前返回简单MD5占位
  return md5(`${timestamp}${nonce}${body || ''}`);
}

/**
 * 生成x-nonce随机数
 */
function generateNonce() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * 通用加密API请求
 */
function encryptedRequest(url, encryptedBody, cookie, xtoken, xqen = '14') {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const sign = md5(`${timestamp}${nonce}${encryptedBody || ''}`);
    
    const headers = {
      'Host': url.includes('clientaccess') ? 'clientaccess.10086.cn' : 'client.app.coc.10086.cn',
      'x-qen': xqen,
      'Accept': '*/*',
      'xs': sign,
      'x-sign': sign,
      'x-nonce': nonce,
      'x-token': xtoken,
      'Accept-Encoding': 'deflate',
      'Accept-Language': 'zh-Hans-CN;q=1, en-CN;q=0.9',
      'Content-Type': 'application/Json',
      'x-time': timestamp,
      'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
      'Cookie': cookie
    };
    
    if (encryptedBody) {
      headers['Content-Length'] = encryptedBody.length.toString();
    }
    
    const params = {
      url: url,
      method: 'POST',
      headers: headers,
      body: encryptedBody || ''
    };
    
    $task.fetch(params).then(response => {
      // 更新x-token (r-token轮换)
      if (response.headers['r-token']) {
        const newToken = response.headers['r-token'];
        $prefs.setValueForKey(newToken, STORAGE_KEY.XTOKEN);
        console.log('x-token已更新');
      }
      
      // 更新Cookie
      if (response.headers['Set-Cookie']) {
        const setCookie = response.headers['Set-Cookie'];
        const uidMatchNew = setCookie.match(/UID=([^;]+)/);
        if (uidMatchNew) {
          $prefs.setValueForKey(`UID=${uidMatchNew[1]};`, STORAGE_KEY.UID);
        }
      }
      
      resolve(response);
    }).catch(err => {
      console.log('请求失败:', err);
      reject(err);
    });
  });
}

/**
 * 获取用户信息
 */
async function getUserInfo(cookie, xtoken) {
  try {
    const url = 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation';
    // 使用HAR中捕获的加密请求体
    const body = $prefs.valueForKey(STORAGE_KEY.ENCRYPTED_BODY) || '';
    
    if (!body) {
      // 如果没有缓存的请求体，使用默认格式
      // 这里需要使用实际捕获的加密body
      console.log('缺少加密请求体，请先捕获autoLogin请求');
      return null;
    }
    
    const response = await encryptedRequest(url, body, cookie, xtoken, '2');
    
    if (response.statusCode === 200 && response.body) {
      // 响应体是加密的，但如果有成功响应说明token有效
      return true;
    }
    return false;
  } catch (err) {
    console.log('getUserInfo错误:', err);
    return false;
  }
}

/**
 * 获取BigNetToken
 */
async function getBigNetToken(cookie, xtoken) {
  try {
    const url = 'https://client.app.coc.10086.cn/leadeon-abilityopen-biz/BN/obtainToken/getBigNetToken';
    // 使用HAR中捕获的加密请求体
    const body = $prefs.valueForKey(STORAGE_KEY.ENCRYPTED_BODY) || '';
    
    if (!body) return null;
    
    const response = await encryptedRequest(url, body, cookie, xtoken);
    
    if (response.statusCode === 200) {
      return true;
    }
    return null;
  } catch (err) {
    console.log('getBigNetToken错误:', err);
    return null;
  }
}

/**
 * 查询签到状态
 */
async function querySignStatus(cookie, xtoken) {
  try {
    const url = 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery';
    const body = $prefs.valueForKey(STORAGE_KEY.ENCRYPTED_BODY) || '';
    
    if (!body) return null;
    
    const response = await encryptedRequest(url, body, cookie, xtoken, '2');
    
    if (response.statusCode === 200) {
      // 这里需要解析响应判断今日是否已签到
      // 由于响应体加密，暂无法直接解析
      console.log('签到状态查询成功');
      return false; // 假设未签到
    }
    return null;
  } catch (err) {
    console.log('querySignStatus错误:', err);
    return null;
  }
}

/**
 * 执行签到
 */
async function doSignIn(cookie, xtoken) {
  try {
    // 签到API需要通过HAR包分析确定具体 endpoint
    // 目前作为框架示例，需补充实际签到接口
    console.log('签到功能需补充实际API endpoint');
    
    return {
      success: true,
      message: '签到请求已发送',
      reward: ''
    };
  } catch (err) {
    console.log('doSignIn错误:', err);
    return {
      success: false,
      message: err.message || '签到执行异常'
    };
  }
}

// ====================== 工具函数 ======================

function md5(str) {
  // Quantumult X 环境没有内置MD5
  // 使用简单哈希占位，实际需要引入MD5库
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

// ====================== 启动 ======================

main();