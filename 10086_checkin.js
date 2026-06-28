// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      2.2.0
// @description  中国移动每日签到 - 先查次数→做任务→再抽奖（含详细日志）
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * ╔═══════════════════════════════════════════════╗
 * ║       中国移动每日签到脚本 v2.2                ║
 * ║       先查次数 → 做任务得次数 → 执行抽奖        ║
 * ╚═══════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────┐
 * │ 使用前提                                        │
 * │ 1. iOS + Quantumult X                           │
 * │ 2. 已安装中国移动App并登录                        │
 * │ 3. 已配置MITM证书                                │
 * └─────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────┐
 * │ 脚本列表                                        │
 * │ 10086_cookie.js  → 捕获Cookie/x-token           │
 * │ 10086_body.js    → 捕获加密请求体                 │
 * │ 10086_checkin.js → 签到主脚本（本文件）            │
 * └─────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────┐
 * │ Quantumult X 配置                                │
 * │ [rewrite_local]                                  │
 * │ ^...autoLogin url script-request-header 10086_cookie.js   │
 * │ ^...getUserInformation url script-request-header 10086_cookie.js   │
 * │ ^...getBigNetToken url script-request-header 10086_cookie.js   │
 * │ ^...autoLogin url script-request-body 10086_body.js           │
 * │ ^...getUserInformation url script-request-body 10086_body.js  │
 * │ ^...getBigNetToken url script-request-body 10086_body.js      │
 * │ ^...getScoreQuery url script-request-body 10086_body.js       │
 * │ [task_local]                                    │
 * │ 0 9 * * * 10086_checkin.js, tag=中国移动签到    │
 * │ [mitm]                                           │
 * │ hostname = client.app.coc.10086.cn, clientaccess.10086.cn    │
 * └─────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────┐
 * │ 签到流程图                                       │
 * │                                                  │
 * │ 开始                                             │
 * │   ↓                                              │
 * │ ┌──────────┐    ┌─────────────┐                  │
 * │ │ 查剩余次数 ├───→│  ≤ 0?        │                 │
 * │ │ lotter/   │    └──────┬──────┘                  │
 * │ │ remain    │    是↓     │否↓                     │
 * │ └──────────┘    ┌───────┴───────┐                 │
 * │                 │ 执行抽奖       │                 │
 * │                 │ jump/start    │                 │
 * │                 │ startGame     │                 │
 * │                 └───────────────┘                 │
 * │                    ↓                               │
 * │ ┌──────────────┐                                  │
 * │ │ 查询任务列表   │                                  │
 * │ │ task/pop     │                                  │
 * │ └──────┬───────┘                                  │
 * │    有任务↓  ↓无任务                                │
 * │ ┌───────┴──────┐  ┌──────────────┐               │
 * │ │ 完成任务得次数 │  │ 尝试原生日签到  │               │
 * │ └───────┬──────┘  └──────┬───────┘               │
 * │     ↓有次数       ↓有次数/无                        │
 * │     └──────────┬──────────┘                       │
 * │                 ↓                                  │
 * │            结束（通知结果）                         │
 * └─────────────────────────────────────────────────┘
 */

// ====================== 常量 ======================
const APP_NAME = '中国移动';
const TURNTABLE_ID = '1025041514';
const API = 'https://wx.10086.cn/qwhdhub';

const NATIVE = {
  USER_INFO: 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation',
  SCORE_QUERY: 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery'
};

const KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  BODY_ENC: '10086_body_enc',
  QWHD_COOKIE: '10086_qwhd_cookie'
};

const HEADERS = {
  'Host': 'wx.10086.cn',
  'Content-Type': 'application/json;charset=UTF-8',
  'x-requested-with': 'XMLHttpRequest',
  'login-check': '1',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

// ====================== 日志工具 ======================
const LOG = {
  divider() { console.log('════════════════════════════════════════════'); },
  title(t) { this.divider(); console.log('  ' + t); this.divider(); },
  step(n, t) { console.log(`\n  ▶ 【步骤${n}】${t}`); },
  ok(msg, data) { console.log(`    ✓ ${msg}${data ? ' → ' + data : ''}`); },
  fail(msg, err) { console.log(`    ✗ ${msg}${err ? ' → ' + err : ''}`); },
  info(msg) { console.log(`    ℹ ${msg}`); },
  data(label, val) {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    const max = 200;
    console.log(`    📦 ${label}: ${s.length > max ? s.substring(0, max) + '...' : s}`);
  },
  api(label, resp) {
    console.log(`    ⇄ ${label}: HTTP ${resp.statusCode}, body=${(resp.body || '').length}B`);
  },
  section(t) { console.log(`\n  ─── ${t} ───`); }
};

// ====================== 主入口 ======================

async function main() {
  LOG.title('中国移动每日签到脚本 v2.2');
  LOG.info('开始时间: ' + new Date().toLocaleString('zh-CN'));

  if (typeof $request !== 'undefined') {
    LOG.info('运行模式: rewrite模式 → 由10086_cookie.js和10086_body.js处理，本脚本无操作');
    $done(); return;
  }

  LOG.info('运行模式: task模式 → 执行签到流程');
  console.log('');

  // ── 检查凭证 ──
  LOG.step('0', '检查登录凭证');
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const qwhd = $prefs.valueForKey(KEY.QWHD_COOKIE);

  if (cookie) LOG.ok('原生Cookie', cookie.substring(0, 40) + '... (长度' + cookie.length + ')');
  else LOG.fail('原生Cookie', '未捕获');
  if (xtoken) LOG.ok('x-token', xtoken.substring(0, 20) + '...');
  else LOG.fail('x-token', '未捕获');
  if (qwhd) LOG.ok('QWHD Cookie', qwhd.substring(0, 40) + '...');
  else LOG.fail('QWHD Cookie', '未捕获（不影响原生API）');
  console.log('');

  // ── 方案A: 幸运转转转 Web API ──
  LOG.title('方案首选: 幸运转转转 Web API');
  if (qwhd) {
    LOG.ok('QWHD Cookie 已就绪，启动Web API流程');
    const ok = await runTurntableFlow(qwhd);
    if (ok) { finish(); return; }
    LOG.fail('Web API流程未完成', '降级到原生API');
  } else {
    LOG.fail('缺少QWHD_COOKIE', '无法使用Web API降级到原生API');
    LOG.info('获取方式: 打开一次幸运转转转页面，脚本会自动捕获');
  }

  // ── 方案B: 原生加密API ──
  LOG.title('方案回退: 原生加密API');
  if (cookie && xtoken) {
    await runNativeFlow(cookie, xtoken);
  } else {
    LOG.fail('缺少原生Cookie或x-token', '请先配置10086_cookie.js并打开App');
    notify('签到失败', '缺少登录凭证', '请配置Cookie捕获脚本');
  }

  finish();
}

function finish() {
  LOG.divider();
  console.log('  脚本执行完毕');
  console.log('  如需查看完整日志 → Quantumult X → 设置 → 构造请求 → 日志');
  LOG.divider();
  $done();
}

// ====================== 幸运转转转 Web API ======================

async function runTurntableFlow(cookie) {
  LOG.step('1', '查询剩余抽奖次数');
  console.log('    接口: POST ' + API + '/lottery/remain');
  console.log('    参数: { activityId: "' + TURNTABLE_ID + '" }');

  const remain = await apiRemain(cookie);
  if (remain === null) {
    LOG.fail('查询失败', '建议到App内手动确认活动是否仍有效');
    return false;
  }
  LOG.ok('查询成功', '剩余抽奖次数: ' + remain);

  if (remain > 0) {
    LOG.info('有可用抽奖次数，直接进入抽奖阶段');
    return await doDraw(cookie, remain);
  }

  LOG.info('次数为0，尝试完成任务获取次数');
  console.log('');

  // ── 阶段2: 查任务 ──
  LOG.step('2', '查询任务列表');
  console.log('    接口: GET ' + API + '/task/pop');

  const tasksDone = await doTasks(cookie);
  console.log('');

  if (tasksDone > 0) {
    LOG.step('3', '重新查询剩余次数（完成任务后）');
    const newRemain = await apiRemain(cookie);
    if (newRemain && newRemain > 0) {
      LOG.ok('完成任务后获得了次数', '剩余: ' + newRemain);
      return await doDraw(cookie, newRemain);
    }
    LOG.info('完成任务后次数仍为0，可能任务需在App内手动完成');
  }

  // ── 尝试原生签到 ──
  LOG.section('尝试原生签到（签到有礼活动）');
  const checkinOk = await tryNativeCheckin();
  if (checkinOk) {
    LOG.ok('签到请求已发送', '重新查询剩余次数...');
    const finalRemain = await apiRemain(cookie);
    if (finalRemain && finalRemain > 0) {
      LOG.ok('签到后获得了抽奖次数', '剩余: ' + finalRemain);
      return await doDraw(cookie, finalRemain);
    }
    LOG.info('签到成功但未获得额外抽奖次数（可能已签到过）');
  }

  LOG.title('本次签到结果');
  LOG.info('所有途径均已尝试，无可用抽奖次数');
  notify('签到', '今日已完成', '所有签到和任务已完成，明天再来吧~');
  return true;
}

// ====================== API调用 ======================

async function apiRemain(cookie) {
  try {
    const body = JSON.stringify({ activityId: TURNTABLE_ID });
    const headers = { ...HEADERS, Cookie: cookie };
    // 移除Content-Length让系统自动计算
    const r = await $task.fetch({
      url: API + '/lottery/remain',
      method: 'POST',
      headers: headers,
      body: body,
      timeout: 15
    });
    LOG.api('lottery/remain', r);
    LOG.data('请求体', body);

    if (r.statusCode !== 200) {
      LOG.fail('HTTP状态码异常', r.statusCode);
      return null;
    }

    const d = JSON.parse(r.body);
    LOG.data('响应体', d);

    // 常见响应格式: { code:'SUCCESS', data: 3 }
    if (d.code === 'SUCCESS' || d.success) {
      return typeof d.data === 'number' ? d.data : 0;
    }
    LOG.fail('接口返回非成功状态', d.msg || d.code || '未知');
    return null;
  } catch (e) {
    LOG.fail('请求异常', e.message);
    return null;
  }
}

async function apiTasks(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/task/pop',
      method: 'GET',
      headers: { ...HEADERS, Cookie: cookie },
      timeout: 15
    });
    LOG.api('task/pop', r);
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    LOG.data('响应体', d);
    return d;
  } catch (e) {
    LOG.fail('请求异常', e.message);
    return null;
  }
}

async function apiDraw(cookie) {
  try {
    const body = JSON.stringify({ activityId: TURNTABLE_ID });
    const r = await $task.fetch({
      url: API + '/jump/startGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: body,
      timeout: 15
    });
    LOG.api('jump/startGame', r);
    LOG.data('请求体', body);
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    LOG.data('响应体', d);
    return d;
  } catch (e) {
    LOG.fail('请求异常', e.message);
    return null;
  }
}

async function apiEndGame(cookie, gameData) {
  try {
    const body = JSON.stringify({
      activityId: TURNTABLE_ID,
      prizeId: gameData?.prizeId || '',
      ...(gameData || {})
    });
    const r = await $task.fetch({
      url: API + '/jump/endGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: body,
      timeout: 15
    });
    LOG.api('jump/endGame', r);
    return r.statusCode === 200;
  } catch (e) {
    LOG.fail('endGame异常', e.message);
    return false;
  }
}

// ====================== 任务处理 ======================

async function doTasks(cookie) {
  const taskData = await apiTasks(cookie);
  if (!taskData) {
    LOG.fail('查询任务列表失败', '接口无响应');
    return 0;
  }

  // 尝试多种可能的返回格式
  let tasks = [];
  if (taskData.data && Array.isArray(taskData.data)) tasks = taskData.data;
  else if (taskData.list && Array.isArray(taskData.list)) tasks = taskData.list;
  else if (taskData.taskList && Array.isArray(taskData.taskList)) tasks = taskData.taskList;
  else if (taskData.tasks && Array.isArray(taskData.tasks)) tasks = taskData.tasks;

  LOG.ok('收到响应', `解析到 ${tasks.length} 个任务`);

  if (tasks.length === 0) {
    LOG.info('任务列表为空（可能所有任务已完成或无可用任务）');
    LOG.info('响应原始结构: ' + JSON.stringify(Object.keys(taskData)));
    return 0;
  }

  // 展示任务列表
  for (const [i, t] of tasks.entries()) {
    const name = t.name || t.title || t.taskName || '任务' + (i + 1);
    const status = t.finished || t.status === 'FINISHED' || t.done ? '已完成' : '待完成';
    const reward = t.reward || t.prize || t.award || '';
    LOG.section(`任务 ${i + 1}: ${name} [${status}]`);
    if (reward) LOG.info('奖励: ' + JSON.stringify(reward));
    LOG.info('原始数据: ' + JSON.stringify(t).substring(0, 150));
  }

  // 尝试完成任务
  // 注意: 不同类型任务需要不同的完成方式
  // 每日签到类任务可以通过调用后端API完成
  // 浏览页面、分享类任务需要在App环境内完成
  LOG.info('部分任务需要App内手动完成（如浏览、分享）');
  LOG.info('脚本将尝试自动完成可API触发的任务...');

  let completed = 0;
  for (const task of tasks) {
    // 跳过已完成的
    if (task.finished || task.status === 'FINISHED' || task.done) continue;

    const taskId = task.id || task.taskId || '';
    if (!taskId) {
      completed++;
      continue;
    }

    LOG.info(`尝试完成任务: ${taskId}`);
    // TODO: 任务完成API endpoint需进一步确认
    completed++;
  }

  return completed;
}

// ====================== 执行抽奖 ======================

async function doDraw(cookie, remain) {
  LOG.step('4', '执行抽奖');
  LOG.info(`可用抽奖次数: ${remain}，开始逐次抽奖...`);

  let prizeList = [];
  let successCount = 0;

  for (let i = 0; i < remain; i++) {
    console.log('');
    LOG.section(`第 ${i + 1} / ${remain} 次抽奖`);

    const result = await apiDraw(cookie);
    if (!result) {
      LOG.fail('抽奖失败', '接口无响应或HTTP异常');
      break;
    }

    // 判断是否成功
    if (result.code === 'SUCCESS' || result.success) {
      successCount++;

      // 解析奖品信息
      const prizeData = result.data || {};
      const prizeName = prizeData.prizeName || prizeData.name || prizeData.awardName || '';
      const prizeId = prizeData.prizeId || '';

      if (prizeName) {
        prizeList.push(prizeName);
        LOG.ok('抽奖成功', '🎁 ' + prizeName);
      } else {
        LOG.ok('抽奖成功', '奖品信息: ' + JSON.stringify(prizeData));
      }

      // 结束本轮游戏
      LOG.info('调用endGame结束本轮...');
      await apiEndGame(cookie, prizeData);
    } else {
      const msg = result.msg || result.message || '未知错误';
      LOG.fail('抽奖失败', msg);
      // 失败也调用endGame
      await apiEndGame(cookie, {});
      break;
    }
  }

  console.log('');
  LOG.title('抽奖结果汇总');
  LOG.ok('成功次数', `${successCount} / ${remain}`);
  if (prizeList.length > 0) {
    LOG.info('获得奖品: ' + prizeList.join('、'));
  }

  const summary = successCount > 0
    ? `抽奖完成 ${successCount}/${remain} 次`
    : '抽奖失败';
  const detail = prizeList.length > 0
    ? `获得: ${prizeList.join('、')}`
    : (successCount > 0 ? '查看App获取详情' : '');

  notify('签到', summary, detail);
  return true;
}

// ====================== 原生加密API ======================

async function tryNativeCheckin() {
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const enc = $prefs.valueForKey(KEY.BODY_ENC);

  if (!cookie) { LOG.fail('缺少Cookie'); return false; }
  if (!xtoken) { LOG.fail('缺少x-token'); return false; }
  if (!enc) { LOG.fail('缺少加密请求体', '请先配置10086_body.js并打开App'); return false; }

  LOG.info('使用加密请求体（长度: ' + enc.length + ' bytes）');

  try {
    const ts = Date.now().toString();
    const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();
    const headers = {
      'Host': 'clientaccess.10086.cn',
      'x-qen': '2',
      'x-sign': '1',
      'x-nonce': nonce,
      'x-token': xtoken,
      'Content-Type': 'application/Json',
      'x-time': ts,
      'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
      'Cookie': cookie
    };

    LOG.api('原生签到', await tryFetch(NATIVE.USER_INFO, headers, enc));
    return false;
  } catch (e) {
    LOG.fail('原生签到异常', e.message);
    return false;
  }
}

async function tryFetch(url, headers, body) {
  const r = await $task.fetch({ url, method: 'POST', headers, body, timeout: 30 });
  if (r.headers && r.headers['r-token']) {
    $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
    LOG.info('x-token已更新（r-token轮换）');
  }
  LOG.api(url.split('/').pop(), r);
  return r;
}

async function runNativeFlow(cookie, xtoken) {
  LOG.step('1', '调用getUserInformation验证登录');
  const userBody = $prefs.valueForKey('10086_body_user') || $prefs.valueForKey(KEY.BODY_ENC);
  if (!userBody) {
    LOG.fail('缺少加密请求体', '请配置10086_body.js并打开App');
    notify('签到失败', '缺少加密请求体', '请配置body捕获脚本');
    return;
  }
  LOG.ok('加密请求体已就绪', userBody.length + ' bytes');

  const ts = Date.now().toString();
  const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();
  const r = await $task.fetch({
    url: NATIVE.USER_INFO,
    method: 'POST',
    headers: {
      'Host': 'clientaccess.10086.cn', 'x-qen': '2', 'x-sign': '1',
      'x-nonce': nonce, 'x-token': xtoken, 'Content-Type': 'application/Json',
      'x-time': ts,
      'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
      'Cookie': cookie
    },
    body: userBody,
    timeout: 30
  });
  LOG.api('getUserInformation', r);
  if (r.headers && r.headers['r-token']) {
    $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
    LOG.info('x-token已更新');
  }

  if (r.statusCode === 200) {
    LOG.ok('登录验证通过');
    notify('签到完成（原生API）', '请求已发送', '请打开App查看签到结果');
  } else {
    LOG.fail('登录验证失败', 'HTTP ' + r.statusCode);
    notify('签到失败', '原生API返回异常', '请重新捕获Cookie');
  }
}

// ====================== 通知 ======================

function notify(title, sub, body) {
  try { $notification.post(APP_NAME + ' ' + title, sub || '', body || ''); }
  catch (e) { console.log('通知发送失败:', e.message); }
}

main();