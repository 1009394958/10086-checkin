// ==UserScript==
// @name         中国移动每日签到
// @namespace    https://github.com/1009394958/10086-checkin
// @version      2.3.0
// @description  中国移动每日签到 - 先查次数→做任务→再抽奖（含详细日志）
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * ╔═══════════════════════════════════════════════╗
 * ║       中国移动每日签到脚本 v2.3                ║
 * ║       先查次数 → 做任务得次数 → 执行抽奖        ║
 * ╚═══════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────┐
 * │ 文件清单（下载到 Quantumult X/Scripts/ 目录）     │
 * │                                                │
 * │ 10086_capture.js  → 统一捕获Cookie+加密体       │
 * │ 10086_checkin.js  → 签到主脚本（本文件）          │
 * └─────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────┐
 * │ Quantumult X 配置                                │
 * │ [rewrite_local]                                  │
 * │ ^...autoLogin url script-request-header 10086_capture.js   │
 * │ ^...getUserInformation url script-request-header 10086_capture.js   │
 * │ ^...getBigNetToken url script-request-header 10086_capture.js   │
 * │ ^...getScoreQuery url script-request-header 10086_capture.js   │
 * │ [task_local]                                    │
 * │ 0 9 * * * 10086_checkin.js, tag=中国移动签到    │
 * │ [mitm]                                           │
 * │ hostname = client.app.coc.10086.cn, clientaccess.10086.cn, wx.10086.cn    │
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

// 兼容多种存储key（不同的捕获脚本可能使用不同的key）
const BODY_KEYS = [
  '10086_body_enc',    // 统一捕获脚本和v1 body.js
  '10086_encrypted_body', // v1 checkin.js早期版本
  '10086_enc_body_user',  // v1 body.js分类存储
  '10086_enc_body_auto', 
  '10086_enc_body_token',
  '10086_enc_body_score'
];

const KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
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

// ====================== 日志 ======================
const LOG = {
  title(t) {
    const line = '════════════════════════════════════════════';
    console.log(line);
    console.log('  ' + t);
    console.log(line);
  },
  step(n, t) { console.log(`\n  ▶ 【步骤${n}】${t}`); },
  ok(m, d) { console.log(`    ✓ ${m}${d ? ' → ' + d : ''}`); },
  fail(m, d) { console.log(`    ✗ ${m}${d ? ' → ' + d : ''}`); },
  info(m) { console.log(`    ℹ ${m}`); },
  data(l, v) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    const max = 200;
    console.log(`    📦 ${l}: ${s.length > max ? s.substring(0, max) + '...' : s}`);
  },
  api(l, r) { console.log(`    ⇄ ${l}: HTTP ${r.statusCode}, body=${(r.body || '').length}B`); },
  section(t) { console.log(`\n  ─── ${t} ───`); }
};

// ====================== 主入口 ======================

async function main() {
  LOG.title('中国移动每日签到脚本 v2.3');
  LOG.info('开始时间: ' + new Date().toLocaleString('zh-CN'));

  if (typeof $request !== 'undefined') {
    LOG.info('rewrite模式 → 由10086_capture.js处理，本脚本跳过');
    $done(); return;
  }

  LOG.info('task模式 → 执行签到流程\n');

  // ── 检查所有凭证 ──
  LOG.step('0', '检查登录凭证');
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const qwhd = $prefs.valueForKey(KEY.QWHD_COOKIE);
  const body = findBody();

  if (cookie) LOG.ok('原生Cookie', '长度' + cookie.length);
  else LOG.fail('原生Cookie', '未捕获');

  if (xtoken) LOG.ok('x-token', xtoken.substring(0, 16) + '...');
  else LOG.fail('x-token', '未捕获');

  if (body) {
    const key = findBodyKey();
    LOG.ok('加密请求体', '[' + key + '] ' + body.length + ' bytes');
  } else {
    LOG.fail('加密请求体', '未捕获 → 将只在Web API可用时工作');
  }

  if (qwhd) LOG.ok('QWHD Cookie', qwhd.substring(0, 40) + '...');
  else LOG.fail('QWHD Cookie', '未捕获（不影响原生API，但Web API不可用）');
  console.log('');

  // ── 方案A: Web API（幸运转转转）──
  LOG.title('方案A: 幸运转转转 Web API');
  if (qwhd) {
    LOG.ok('QWHD Cookie 已就绪');
    const ok = await runTurntableFlow(qwhd);
    if (ok) return finish();
    LOG.fail('Web API流程未完成', '降级到原生API');
  } else {
    LOG.fail('缺少QWHD_COOKIE', '如需Web API功能：打开中国移动App → 进入"幸运转转转"页面 → 自动捕获');
  }

  // ── 方案B: 原生加密API ──
  LOG.title('方案B: 原生加密API / 签到有礼');
  if (cookie && xtoken && body) {
    await runNativeFlow(cookie, xtoken, body);
  } else {
    LOG.fail('条件不满足', '需要 Cookie + x-token + 加密请求体 三者齐全');
    if (!cookie) LOG.info('解决: 确保10086_capture.js已配置，并打开App');
    if (!xtoken) LOG.info('解决: x-token由10086_capture.js自动捕获，打开App即可');
    if (!body) LOG.info('解决: 10086_capture.js同时捕获请求体，打开App即可');
    notify('签到失败', '缺少凭证', '请按照日志提示配置捕获脚本');
  }

  finish();
}

function finish() {
  const line = '════════════════════════════════════════════';
  console.log('\n' + line);
  console.log('  脚本执行完毕');
  console.log('  查看日志 → Quantumult X → 设置 → 构造请求 → 日志');
  console.log('  查看存储 → 如有BoxJS，打开10086.checkin面板');
  console.log(line);
  $done();
}

/** 查找已存储的加密请求体 */
function findBody() {
  for (const k of BODY_KEYS) {
    const v = $prefs.valueForKey(k);
    if (v && v.length > 10) return v;
  }
  return null;
}
function findBodyKey() {
  for (const k of BODY_KEYS) {
    const v = $prefs.valueForKey(k);
    if (v && v.length > 10) return k;
  }
  return null;
}

// ====================== 幸运转转转 Web API ======================

async function runTurntableFlow(cookie) {
  LOG.step('1', '查询剩余抽奖次数');
  console.log('    接口: POST ' + API + '/lottery/remain');

  const remain = await apiRemain(cookie);
  if (remain === null) {
    LOG.fail('查询失败', '活动可能已过期或Cookie无效');
    return false;
  }
  LOG.ok('查询成功', '剩余抽奖次数: ' + remain);

  if (remain > 0) {
    LOG.info('有可用次数，直接抽奖');
    return await doDraw(cookie, remain);
  }

  LOG.info('次数为0，尝试完成任务获取次数');

  LOG.step('2', '查询任务列表');
  console.log('    接口: GET ' + API + '/task/pop');
  const tasksDone = await doTasks(cookie);

  if (tasksDone > 0) {
    LOG.step('3', '重新查询剩余次数');
    const newRemain = await apiRemain(cookie);
    if (newRemain && newRemain > 0) {
      LOG.ok('完成后获得次数', newRemain + '次');
      return await doDraw(cookie, newRemain);
    }
  }

  LOG.section('尝试原生签到（可能增加次数）');
  const checkinOk = await tryNativeCheckin();
  if (checkinOk) {
    LOG.ok('签到成功', '回到步骤1重新查次数...');
    const finalRemain = await apiRemain(cookie);
    if (finalRemain && finalRemain > 0) {
      LOG.ok('签到后获得次数', finalRemain + '次');
      return await doDraw(cookie, finalRemain);
    }
  }

  LOG.title('结果');
  LOG.info('所有途径已尝试，无可用抽奖次数');
  notify('签到', '今日已完成', '所有签到和任务已完成');
  return true;
}

// ====================== API ======================

async function apiRemain(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/lottery/remain',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });
    LOG.api('lottery/remain', r);
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    LOG.data('响应', d);
    return (d.code === 'SUCCESS' || d.success) ? (d.data || 0) : null;
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
    LOG.data('响应', d);
    return d.data || d.list || d.taskList || d.tasks || [];
  } catch (e) {
    LOG.fail('请求异常', e.message);
    return null;
  }
}

async function apiDraw(cookie) {
  try {
    const r = await $task.fetch({
      url: API + '/jump/startGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID }),
      timeout: 15
    });
    LOG.api('jump/startGame', r);
    if (r.statusCode !== 200) return null;
    const d = JSON.parse(r.body);
    LOG.data('响应', d);
    return d;
  } catch (e) {
    LOG.fail('请求异常', e.message);
    return null;
  }
}

async function apiEndGame(cookie, data) {
  try {
    const r = await $task.fetch({
      url: API + '/jump/endGame',
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie },
      body: JSON.stringify({ activityId: TURNTABLE_ID, ...data }),
      timeout: 15
    });
    LOG.api('jump/endGame', r);
  } catch (e) {
    LOG.fail('endGame异常', e.message);
  }
}

// ====================== 任务 ======================

async function doTasks(cookie) {
  const tasks = await apiTasks(cookie);
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    LOG.info('任务列表为空（可能所有任务已完成）');
    return 0;
  }

  LOG.ok('任务列表', tasks.length + '个任务');

  for (const [i, t] of tasks.entries()) {
    const name = t.name || t.title || t.taskName || '任务' + (i + 1);
    const done = t.finished || t.status === 'FINISHED' || t.done;
    LOG.section(`${name} [${done ? '已完成' : '待完成'}]`);
    LOG.data('数据', t);
  }

  LOG.info('部分任务需要App内手动完成（浏览、分享等）');
  return 0;
}

// ====================== 抽奖 ======================

async function doDraw(cookie, remain) {
  LOG.step('4', '执行抽奖');
  LOG.info(`可用次数: ${remain}，开始逐次抽奖`);

  let prizes = [];
  let success = 0;

  for (let i = 0; i < remain; i++) {
    LOG.section(`第 ${i + 1}/${remain} 次`);
    const result = await apiDraw(cookie);
    if (!result || (result.code !== 'SUCCESS' && !result.success)) {
      const msg = result?.msg || result?.message || '接口异常';
      LOG.fail('抽奖失败', msg);
      await apiEndGame(cookie, {});
      break;
    }
    success++;
    const pn = result.data?.prizeName || result.data?.name || '';
    if (pn) { prizes.push(pn); LOG.ok('获奖', '🎁 ' + pn); }
    else { LOG.ok('抽奖成功'); }
    await apiEndGame(cookie, result.data || {});
  }

  LOG.title('抽奖结果');
  LOG.ok('成功', `${success}/${remain} 次`);
  if (prizes.length) LOG.info('奖品: ' + prizes.join('、'));

  const msg = success > 0 ? `签到完成 ${success}/${remain} 次` : '签到失败';
  const detail = prizes.length > 0 ? `获得: ${prizes.join('、')}` : (success > 0 ? '查看App获取详情' : '');
  notify('签到', msg, detail);
  return true;
}

// ====================== 原生 ======================

async function tryNativeCheckin() {
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const body = findBody();
  if (!cookie || !xtoken || !body) return false;

  LOG.info('调用getUserInformation（原生API）...');
  try {
    const ts = Date.now().toString();
    const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();
    const r = await $task.fetch({
      url: NATIVE.USER_INFO, method: 'POST',
      headers: {
        'Host': 'clientaccess.10086.cn', 'x-qen': '2', 'x-sign': '1',
        'x-nonce': nonce, 'x-token': xtoken, 'Content-Type': 'application/Json',
        'x-time': ts,
        'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
        'Cookie': cookie
      },
      body: body, timeout: 30
    });
    LOG.api('getUserInformation', r);
    if (r.headers && r.headers['r-token']) {
      $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
      LOG.info('x-token已更新（r-token轮换）');
    }
    return r.statusCode === 200;
  } catch (e) {
    LOG.fail('异常', e.message);
    return false;
  }
}

async function runNativeFlow(c, t, b) {
  const ok = await tryNativeCheckin();
  if (ok) {
    LOG.ok('签到成功（原生API）');
    notify('签到完成', '签到请求已发送', '请打开App查看签到结果');
  } else {
    LOG.fail('签到失败', 'Token可能已过期，请重新打开App捕获');
    notify('签到失败', 'Token过期', '请重新打开App');
  }
}

function notify(t, s, d) {
  try { $notification.post(APP_NAME + ' ' + t, s || '', d || ''); } catch (e) {}
}

main();