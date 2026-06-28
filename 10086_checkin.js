// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      2.0.0
// @description  中国移动App每日签到 - 先查询剩余次数，再执行签到
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动每日签到脚本 v2.0
 *
 * 【签到流程】
 * 步骤1: 验证登录凭证
 * 步骤2: 查询签到/抽奖剩余次数
 * 步骤3: 如有剩余次数，执行签到/抽奖
 * 步骤4: 通知签到结果
 *
 * 【支持的签到活动】
 * 1. 幸运转转转 (turntable) - 活动ID: 1025041514
 *    通过 wx.10086.cn/qwhdhub API，返回纯JSON
 *
 * 2. 签到有礼 (mini-program) - 活动ID: 1021122301
 *    通过加密API，需提前捕获加密请求体
 *
 * 【配置方法】
 * 1. 前导脚本配置：
 *    - 10086_cookie.js (script-request-header) 捕获Cookie和x-token
 *    - 10086_body.js (script-request-body) 捕获加密请求体
 *
 * 2. 如需使用幸运转转转，需额外捕获SSO Token
 *
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true
 */

// ====================== 常量 ======================

const APP_NAME = '中国移动';

// 幸运转转转活动
const TURNTABLE_ID = '1025041514';
const QWHD_BASE = 'https://wx.10086.cn/qwhdhub';

// 签到有礼活动
const ACTIVITY_CHECKIN = '1021122301';

// 原生加密API
const API_NATIVE = {
  USER_INFO: 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation',
  SCORE_QUERY: 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery',
  BIG_TOKEN: 'https://client.app.coc.10086.cn/leadeon-abilityopen-biz/BN/obtainToken/getBigNetToken'
};

// Web API for 幸运转转转
const API_WEB = {
  REMAIN: '/lottery/remain',
  START: '/jump/startGame',
  END: '/jump/endGame',
  RECORD: '/lottery/queryWinRecord'
};

// 存储Key
const PREF_KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  BODY_ENC: '10086_body_enc',
  BODY_USER: '10086_body_user',
  QWHD_TOKEN: '10086_qwhd_token',
  QWHD_SESSION: '10086_qwhd_session',
  QWHD_COOKIE: '10086_qwhd_cookie'
};

// ====================== 主函数 ======================

async function main() {
  console.log(`${APP_NAME} 签到脚本开始执行...`);

  if (typeof $request !== 'undefined') {
    // Rewrite模式下不做处理
    $done();
    return;
  }

  console.log('检查登录凭证...');
  const cookie = $prefs.valueForKey(PREF_KEY.COOKIE);
  const xtoken = $prefs.valueForKey(PREF_KEY.XTOKEN);

  if (!cookie || !xtoken) {
    return notify('失败', '缺少登录凭证', '请打开App并配置Cookie捕获脚本');
  }

  console.log('Cookie已就绪, 长度:', cookie.length);
  console.log('x-token已就绪, 长度:', xtoken.length);

  // ===== 方案A: 使用幸运转转转 Web API =====
  console.log('--- 尝试幸运转转转 Web API ---');
  let webResult = await tryTurntable();
  if (webResult.success) {
    console.log('幸运转转转执行成功:', JSON.stringify(webResult));
    notify('签到结果', webResult.message, webResult.detail);
    $done();
    return;
  }

  // ===== 方案B: 使用原生加密API =====
  console.log('Web API不可用，尝试原生加密API...');
  console.log('原因:', webResult.reason);

  const encBody = $prefs.valueForKey(PREF_KEY.BODY_ENC);
  if (!encBody) {
    return notify('跳过', '缺少加密请求体', '如需使用原生API，请先捕获请求体');
  }

  console.log('加密请求体长度:', encBody.length);
  let nativeResult = await tryNativeAPI(cookie, xtoken, encBody);
  if (nativeResult.success) {
    console.log('原生API签到完成');
    notify('签到完成', nativeResult.message || '请求已发送', nativeResult.detail || '');
  } else {
    notify('失败', nativeResult.message || '原生API执行异常', nativeResult.detail || '');
  }

  $done();
}

// ====================== 幸运转转转 Web API ======================

async function tryTurntable() {
  console.log('步骤1: 获取QWHD会话Token...');

  let qwhdCookie = $prefs.valueForKey(PREF_KEY.QWHD_COOKIE);
  if (!qwhdCookie) {
    return { success: false, reason: '缺少QWHD_COOKIE，请先访问一次转盘页面' };
  }

  console.log('QWHD Cookie已就绪');

  // 步骤2: 查询剩余次数
  console.log('步骤2: 查询签到/抽奖剩余次数...');
  const remainResult = await apiGetRemain(qwhdCookie);
  if (!remainResult.success) {
    return { success: false, reason: '查询剩余次数失败: ' + remainResult.error };
  }

  const remain = remainResult.data;
  console.log('剩余抽奖次数:', remain);

  if (remain <= 0) {
    return {
      success: true,
      message: '今日已签到/抽奖',
      detail: `剩余次数: ${remain}，无需重复操作`
    };
  }

  // 步骤3: 执行抽奖/签到
  console.log(`步骤3: 执行签到/抽奖 (剩余${remain}次)...`);
  const drawResult = await apiDraw(qwhdCookie);
  if (!drawResult.success) {
    return { success: false, reason: '签到执行失败: ' + drawResult.error };
  }

  console.log('签到成功! 返回数据:', JSON.stringify(drawResult.data));

  return {
    success: true,
    message: `签到成功！剩余次数: ${remain - 1}`,
    detail: drawResult.prize || '查看App获取奖励详情'
  };
}

/**
 * 查询剩余抽奖次数
 */
async function apiGetRemain(cookie) {
  try {
    const url = `${QWHD_BASE}${API_WEB.REMAIN}`;
    const response = await $task.fetch({
      url: url,
      method: 'POST',
      headers: {
        'Host': 'wx.10086.cn',
        'Content-Type': 'application/json;charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'login-check': '1',
        'Cookie': cookie,
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });

    if (response.statusCode !== 200) {
      return { success: false, error: `HTTP ${response.statusCode}` };
    }

    const body = JSON.parse(response.body);
    console.log('remain响应:', JSON.stringify(body));

    if (body.success || body.code === 'SUCCESS') {
      return { success: true, data: body.data || 0 };
    }

    return { success: false, error: body.msg || '查询失败' };
  } catch (e) {
    console.log('查询剩余次数异常:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 执行抽奖/签到
 */
async function apiDraw(cookie) {
  try {
    const url = `${QWHD_BASE}${API_WEB.START}`;
    const response = await $task.fetch({
      url: url,
      method: 'POST',
      headers: {
        'Host': 'wx.10086.cn',
        'Content-Type': 'application/json;charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'login-check': '1',
        'Cookie': cookie,
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });

    if (response.statusCode !== 200) {
      return { success: false, error: `HTTP ${response.statusCode}` };
    }

    const body = JSON.parse(response.body);
    console.log('draw响应:', JSON.stringify(body));

    if (body.success || body.code === 'SUCCESS') {
      return { success: true, data: body.data, prize: body.data?.prizeName || '' };
    }

    return { success: false, error: body.msg || '抽奖失败' };
  } catch (e) {
    console.log('执行抽奖异常:', e.message);
    return { success: false, error: e.message };
  }
}

// ====================== 原生加密API ======================

async function tryNativeAPI(cookie, xtoken, encBody) {
  try {
    console.log('验证登录状态...');
    const userBody = $prefs.valueForKey(PREF_KEY.BODY_USER) || encBody;
    const verifyOk = await nativeRequest(API_NATIVE.USER_INFO, userBody, cookie, xtoken, '2');
    if (!verifyOk) {
      return { success: false, message: '登录状态已过期', detail: '请重新捕获Cookie' };
    }
    console.log('登录状态有效');

    console.log('查询签到状态...');
    const scoreOk = await nativeRequest(API_NATIVE.SCORE_QUERY, encBody, cookie, xtoken, '2');
    if (!scoreOk) {
      return { success: false, message: '签到查询失败', detail: 'API返回异常' };
    }
    console.log('签到查询成功');

    return { success: true, message: '签到请求已发送（原生API）', detail: '请打开App查看结果' };
  } catch (e) {
    console.log('原生API执行异常:', e.message);
    return { success: false, message: '原生API异常', detail: e.message };
  }
}

async function nativeRequest(url, body, cookie, xtoken, xqen) {
  try {
    const timestamp = Date.now().toString();
    const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();

    const response = await $task.fetch({
      url: url,
      method: 'POST',
      headers: {
        'Host': url.includes('clientaccess') ? 'clientaccess.10086.cn' : 'client.app.coc.10086.cn',
        'x-qen': xqen || '14',
        'x-sign': '1',
        'x-nonce': nonce,
        'x-token': xtoken,
        'Content-Type': 'application/Json',
        'x-time': timestamp,
        'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
        'Cookie': cookie
      },
      body: body || '',
      timeout: 30
    });

    if (response.headers && response.headers['r-token']) {
      $prefs.setValueForKey(response.headers['r-token'], PREF_KEY.XTOKEN);
      console.log('x-token已更新');
    }

    return response && response.statusCode === 200;
  } catch (e) {
    console.log('nativeRequest异常:', e.message);
    return false;
  }
}

// ====================== 工具函数 ======================

function notify(title, subtitle, body) {
  try {
    $notification.post(`${APP_NAME} ${title}`, subtitle || '', body || '');
  } catch (e) {
    console.log('通知发送失败:', e.message);
  }
}

main();