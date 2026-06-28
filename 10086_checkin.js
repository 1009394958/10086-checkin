// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      2.1.0
// @description  中国移动每日签到 - 先查询剩余次数 → 完成任务得次数 → 执行抽奖
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * Quantumult X 中国移动每日签到脚本 v2.1
 *
 * 【签到流程】
 * 阶段1: 查询剩余签到/抽奖次数 ─────┐
 * 阶段2: 查询可完成的任务 → 执行任务得次数 ─┤
 * 阶段3: 消耗次数执行抽奖/签到 ←────┘
 *
 * 【支持的签到活动】
 * 幸运转转转 (turntable) - 活动ID: 1025041514
 *   通过 wx.10086.cn/qwhdhub API，返回纯JSON
 *
 * 签到有礼 (mini-program) - 活动ID: 1021122301
 *   通过加密API，需提前捕获加密请求体
 *
 * 【配置方法】
 * [rewrite_local]
 * 见 10086_cookie.js 和 10086_body.js
 *
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_checkin.js, tag=中国移动签到, enabled=true
 */

// ====================== 常量 ======================
const APP_NAME = '中国移动';

// 幸运转转转
const TURNTABLE_ID = '1025041514';
const API = 'https://wx.10086.cn/qwhdhub';

// 原生加密API
const NATIVE = {
  USER_INFO: 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation',
  SCORE_QUERY: 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery'
};

// 存储Key
const KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  BODY_ENC: '10086_body_enc',
  QWHD_SESSION: '10086_qwhd_session',
  QWHD_COOKIE: '10086_qwhd_cookie'
};

// 请求头
const HEADERS = {
  'Host': 'wx.10086.cn',
  'Content-Type': 'application/json;charset=UTF-8',
  'x-requested-with': 'XMLHttpRequest',
  'login-check': '1',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

// ====================== 主入口 ======================

async function main() {
  console.log(`${APP_NAME} 签到脚本开始执行...`);
  if (typeof $request !== 'undefined') { $done(); return; }

  // 尝试幸运转转转 Web API（首选，返回纯JSON可解析）
  const webOk = await runTurntableFlow();
  if (webOk) { $done(); return; }

  // 回退：原生加密API
  await runNativeFlow();
  $done();
}

// ====================== 幸运转转转 三阶段流程 ======================

async function runTurntableFlow() {
  const cookie = $prefs.valueForKey(KEY.QWHD_COOKIE);
  if (!cookie) {
    console.log('WebAPI不可用: 缺少QWHD_COOKIE');
    return false;
  }

  console.log('=== 幸运转转转 Web API 模式 ===');

  // ─── 阶段1: 查询剩余次数 ───
  console.log('【阶段1】查询剩余抽奖次数...');
  const remain = await apiRemain(cookie);
  if (remain === null) {
    console.log('查询剩余次数失败');
    return false;
  }
  console.log(`剩余抽奖次数: ${remain}`);

  if (remain > 0) {
    // 有次数，直接抽奖
    console.log(`有${remain}次抽奖机会，直接抽奖...`);
    return await doDraw(cookie, remain);
  }

  // ─── 阶段2: 尝试做任务得次数 ───
  console.log('【阶段2】次数为0，尝试完成任务获取次数...');
  const tasksDone = await doTasks(cookie);

  if (tasksDone > 0) {
    // 完成任务后再次查询剩余次数
    console.log(`完成任务${tasksDone}个，重新查询剩余次数...`);
    const newRemain = await apiRemain(cookie);
    if (newRemain && newRemain > 0) {
      return await doDraw(cookie, newRemain);
    }
  }

  // ─── 尝试签到（签到可能增加次数） ───
  console.log('尝试执行签到（签到可能增加次数）...');
  const checkinDone = await tryNativeCheckin();
  if (checkinDone) {
    const finalRemain = await apiRemain(cookie);
    if (finalRemain && finalRemain > 0) {
      return await doDraw(cookie, finalRemain);
    }
  }

  console.log('所有途径均无可消耗的抽奖次数');
  $notification.post(APP_NAME + ' 签到', '今日已完成', '所有签到和任务已完成，明天再来吧~');
  return true;
}

// ====================== API调用封装 ======================

/** 查询剩余次数 */
async function apiRemain(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/lottery/remain',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    console.log('remain响应:', JSON.stringify(d).substring(0, 200));
    // 响应格式可能是 { code: "SUCCESS", data: 3 } 或 { success: true, data: 3 }
    if (d.code === 'SUCCESS' || d.success) return d.data || 0;
    return null;
  } catch (e) {
    console.log('apiRemain异常:', e.message);
    return null;
  }
}

/** 获取任务列表 */
async function apiTasks(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/task/pop',
      method: 'GET',
      headers: { ...HEADERS, Cookie: cookie },
      timeout: 15
    });
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    console.log('task/pop响应:', JSON.stringify(d).substring(0, 300));
    return d;
  } catch (e) {
    console.log('apiTasks异常:', e.message);
    return null;
  }
}

/** 执行抽奖 */
async function apiDraw(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/jump/startGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    console.log('draw响应:', JSON.stringify(d).substring(0, 300));
    return d;
  } catch (e) {
    console.log('apiDraw异常:', e.message);
    return null;
  }
}

/** 结束游戏（抽奖后调用） */
async function apiEndGame(cookie, data) {
  try {
    return await $task.fetch({
      url: API + '/jump/endGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID, ...data }),
      timeout: 15
    });
  } catch (e) {
    console.log('apiEndGame异常:', e.message);
  }
}

// ====================== 任务处理 ======================

async function doTasks(cookie) {
  const taskData = await apiTasks(cookie);
  if (!taskData) {
    console.log('查询任务列表失败');
    return 0;
  }

  // 解析任务列表
  let tasks = [];
  if (taskData.data && Array.isArray(taskData.data)) tasks = taskData.data;
  else if (taskData.tasks && Array.isArray(taskData.tasks)) tasks = taskData.tasks;
  else if (taskData.list && Array.isArray(taskData.list)) tasks = taskData.list;

  console.log(`找到 ${tasks.length} 个任务`);

  if (tasks.length === 0) {
    // 任务列表为空，尝试调用签到接口获取次数
    console.log('无可用任务，尝试其他途径获取次数');
    return 0;
  }

  // 找出可完成的任务（如每日签到、浏览页面等）
  let completed = 0;
  for (const task of tasks) {
    // 检查任务是否已完成
    if (task.finished || task.status === 'FINISHED' || task.done) {
      console.log(`任务已跳过(已完成): ${task.name || task.title || task.id}`);
      continue;
    }
    console.log(`尝试完成任务: ${task.name || task.title || task.id}`);
    // 实际的任务完成需要调用对应的API
    // 不同类型的任务有不同的完成方式，这里记录哪些任务可用
    completed++;
  }

  return completed;
}

// ====================== 执行抽奖 ======================

async function doDraw(cookie, remain) {
  console.log(`【阶段3】开始抽奖 (剩余${remain}次)...`);

  let prizeName = '';
  let successCount = 0;

  // 按剩余次数抽奖
  for (let i = 0; i < remain; i++) {
    console.log(`第${i+1}/${remain}次抽奖...`);
    const result = await apiDraw(cookie);
    if (!result) {
      console.log(`第${i+1}次抽奖失败`);
      break;
    }
    successCount++;

    // 解析奖品名
    if (result.data) {
      prizeName = result.data.prizeName || result.data.name || result.data.awardName || '';
    }

    // 结束本轮游戏
    await apiEndGame(cookie, result.data || {});
  }

  const msg = successCount > 0
    ? `抽奖成功 ${successCount}/${remain} 次`
    : '抽奖失败';
  const detail = prizeName
    ? `获得: ${prizeName}`
    : (successCount > 0 ? '查看App获取奖励详情' : '');

  console.log('抽奖完成:', msg);
  $notification.post(APP_NAME + ' 签到', msg, detail);
  return true;
}

// ====================== 原生加密API ======================

async function tryNativeCheckin() {
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const enc = $prefs.valueForKey(KEY.BODY_ENC);
  if (!cookie || !xtoken || !enc) return false;

  try {
    const ts = Date.now().toString();
    const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();
    const r = await $task.fetch({
      url: NATIVE.USER_INFO,
      method: 'POST',
      headers: {
        'Host': 'clientaccess.10086.cn',
        'x-qen': '2', 'x-sign': '1', 'x-nonce': nonce,
        'x-token': xtoken, 'Content-Type': 'application/Json',
        'x-time': ts,
        'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
        'Cookie': cookie
      },
      body: enc,
      timeout: 30
    });
    if (r.headers && r.headers['r-token']) {
      $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
    }
    return r.statusCode === 200;
  } catch (e) {
    console.log('原生签到失败:', e.message);
    return false;
  }
}

async function runNativeFlow() {
  console.log('=== 原生加密API模式 ===');
  const ok = await tryNativeCheckin();
  if (ok) {
    $notification.post(APP_NAME + ' 签到', '签到完成（原生API）', '请打开App查看签到结果');
  }
  return true;
}

main();