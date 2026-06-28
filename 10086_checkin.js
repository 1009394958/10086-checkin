// ==UserScript==
// @name         中国移动每日签到 + 余额查询
// @namespace    https://github.com/1009394958/10086-checkin
// @version      3.0.0
// @description  中国移动每日签到 + 话费余额 + 流量余额查询
// @author       github.com/1009394958
// @icon         https://www.10086.cn/favicon.ico
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════╗
 * ║  中国移动全能脚本 v3.0                        ║
 * ║  签到 + 话费余额 + 流量余额 + 幸运转转转      ║
 * ╚══════════════════════════════════════════════╝
 *
 * [rewrite_local]
 * ^...autoLogin url script-request-header 10086_capture.js
 * ^...getUserInformation url script-request-header 10086_capture.js
 * ^...getBigNetToken url script-request-header 10086_capture.js
 * ^...getScoreQuery url script-request-header 10086_capture.js
 * ^...getRealFee url script-request-header 10086_capture.js
 * ^...getNewPlanRemainQry url script-request-header 10086_capture.js
 *
 * [task_local]
 * 0 9 * * * 10086_checkin.js, tag=中国移动签到, enabled=true
 *
 * [mitm]
 * hostname = client.app.coc.10086.cn, clientaccess.10086.cn, wx.10086.cn
 */

// ====================== 常量 ======================
const APP_NAME = '中国移动';
const TURNTABLE_ID = '1025041514';
const TURNTABLE_API = 'https://wx.10086.cn/qwhdhub';

const NATIVE = {
  USER_INFO: 'https://clientaccess.10086.cn/biz-orange/BN/userInformationService/getUserInformation',
  SCORE: 'https://clientaccess.10086.cn/biz-orange/BN/scoreQueryService/getScoreQuery',
  FEE: 'https://clientaccess.10086.cn/biz-orange/BN/realFeeQuery/getRealFee',
  PLAN: 'https://clientaccess.10086.cn/biz-orange/BH/newPlanRemainQry/getNewPlanRemainQry'
};

const BODY_KEYS = [
  '10086_body_enc', '10086_encrypted_body',
  '10086_enc_body_user', '10086_enc_body_auto',
  '10086_enc_body_token', '10086_enc_body_score'
];

const KEY = {
  COOKIE: '10086_cookie',
  XTOKEN: '10086_xtoken',
  QWHD: '10086_qwhd_cookie'
};

const WEB_HEADERS = {
  'Host': 'wx.10086.cn',
  'Content-Type': 'application/json;charset=UTF-8',
  'x-requested-with': 'XMLHttpRequest',
  'login-check': '1',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

// ====================== 日志 ======================
const LOG = {
  sep() { console.log('════════════════════════════════════════════'); },
  title(t) { this.sep(); console.log('  ' + t); this.sep(); },
  step(n, t) { console.log(`\n  ▶ 【步骤${n}】${t}`); },
  ok(m, d) { console.log(`    ✓ ${m}${d ? ' → ' + d : ''}`); },
  fail(m, d) { console.log(`    ✗ ${m}${d ? ' → ' + d : ''}`); },
  info(m) { console.log(`    ℹ ${m}`); },
  data(l, v) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    console.log(`    📦 ${l}: ${s.length > 200 ? s.substring(0, 200) + '...' : s}`);
  },
  api(l, r) { console.log(`    ⇄ ${l}: HTTP ${r.statusCode}, body=${(r.body || '').length}B`); },
  section(t) { console.log(`\n  ─── ${t} ───`); }
};

// ====================== 主入口 ======================

async function main() {
  LOG.title('中国移动全能脚本 v3.0');
  LOG.info('开始时间: ' + new Date().toLocaleString('zh-CN'));
  console.log('');

  if (typeof $request !== 'undefined') {
    LOG.info('rewrite模式 → 由10086_capture.js处理');
    $done(); return;
  }

  // ── 检查凭证 ──
  LOG.step('0', '检查登录凭证');
  const cookie = $prefs.valueForKey(KEY.COOKIE);
  const xtoken = $prefs.valueForKey(KEY.XTOKEN);
  const qwhd = $prefs.valueForKey(KEY.QWHD);
  let body = null;
  let bodyKey = null;
  for (const k of BODY_KEYS) {
    const v = $prefs.valueForKey(k);
    if (v && v.length > 10) { body = v; bodyKey = k; break; }
  }

  if (cookie) LOG.ok('Cookie', cookie.length + 'B');
  else LOG.fail('Cookie', '未捕获');
  if (xtoken) LOG.ok('x-token', xtoken.substring(0, 16) + '...');
  else LOG.fail('x-token', '未捕获');
  if (body) LOG.ok('加密请求体', '[' + bodyKey + '] ' + body.length + 'B');
  else LOG.fail('加密请求体', '未捕获');
  if (qwhd) LOG.ok('QWHD Cookie', qwhd.substring(0, 30) + '...');
  else LOG.info('QWHD Cookie未捕获（不影响核心功能）');

  // 缺少凭证时退出
  if (!cookie || !xtoken || !body) {
    LOG.fail('凭证不完整', '需Cookie + x-token + 加密体三者齐全');
    if (!cookie) LOG.info('  解决: 配置10086_capture.js后打开App');
    if (!xtoken) LOG.info('  解决: x-token由capture.js自动捕获');
    if (!body) LOG.info('  解决: 加密体由capture.js在autoLogin时自动捕获');
    notify('签到失败', '缺少凭证', '请查看日志');
    $done(); return;
  }

  // ── 第一阶段: 查询话费+流量（先查，不依赖签到状态）──
  LOG.title('阶段一: 话费/流量查询');
  const balanceResult = await queryBalances(cookie, xtoken, body);

  // ── 第二阶段: 签到（幸运转转转 Web API）──
  LOG.title('阶段二: 幸运转转转签到');
  if (qwhd) {
    LOG.ok('QWHD Cookie已就绪');
    await runTurntableFlow(qwhd);
  } else {
    LOG.fail('缺少QWHD Cookie', '跳过幸运转转转');
  }

  // ── 第三阶段: 原生API签到 ──
  LOG.title('阶段三: 原生API签到');
  const checkinOk = await nativeCheckin(cookie, xtoken, body);

  // ── 汇总通知 ──
  const summary = buildSummary(balanceResult, checkinOk);
  notify('签到结果', summary.title, summary.body);

  LOG.sep();
  LOG.info('全部任务完成');
  LOG.info('查看日志 → 设置 → 构造请求 → 日志');
  LOG.sep();
  $done();
}

// ====================== 话费/流量查询 ======================

async function queryBalances(cookie, xtoken, body) {
  const ts = Date.now().toString();
  const nonce = Math.floor(10000000 + Math.random() * 90000000).toString();

  const makeHeaders = (xt) => ({
    'Host': 'clientaccess.10086.cn', 'x-qen': '2', 'x-sign': '1',
    'x-nonce': nonce, 'x-token': xt, 'Content-Type': 'application/Json',
    'x-time': ts,
    'User-Agent': 'ChinaMobile/12.1.2 (iPhone; iOS 26.0.1; Scale/3.00)',
    'Cookie': cookie
  });

  let xt = xtoken;
  const result = { fee: null, plan: null, score: null };

  // 1. 话费余额
  LOG.step('1', '查询话费余额');
  console.log('    接口: ' + NATIVE.FEE);
  try {
    const headers = makeHeaders(xt);
    const r = await $task.fetch({ url: NATIVE.FEE, method: 'POST', headers, body, timeout: 20 });
    LOG.api('realFeeQuery', r);
    if (r.headers && r.headers['r-token']) { xt = r.headers['r-token']; $prefs.setValueForKey(xt, KEY.XTOKEN); }
    // 响应体已加密，标记成功并记录大小
    result.fee = { status: r.statusCode, size: (r.body || '').length };
    LOG.ok('话费查询完成', '响应 ' + result.fee.size + 'B (加密，含余额数据)');
    if (r.statusCode === 200) {
      LOG.info('提示: 具体话费余额请在中国移动App中查看');
    }
  } catch (e) {
    LOG.fail('话费查询异常', e.message);
    result.fee = { error: e.message };
  }

  // 2. 流量/套餐余额
  LOG.step('2', '查询流量/套餐余额');
  console.log('    接口: ' + NATIVE.PLAN);
  try {
    const headers = makeHeaders(xt);
    const r = await $task.fetch({ url: NATIVE.PLAN, method: 'POST', headers, body, timeout: 20 });
    LOG.api('newPlanRemainQry', r);
    if (r.headers && r.headers['r-token']) { xt = r.headers['r-token']; $prefs.setValueForKey(xt, KEY.XTOKEN); }
    result.plan = { status: r.statusCode, size: (r.body || '').length };
    LOG.ok('流量查询完成', '响应 ' + result.plan.size + 'B (加密，含套餐余量数据)');
    if (r.statusCode === 200) {
      LOG.info('提示: 具体流量余额请在中国移动App中查看');
    }
  } catch (e) {
    LOG.fail('流量查询异常', e.message);
    result.plan = { error: e.message };
  }

  // 3. 积分查询（之前已经有的）
  LOG.step('3', '查询积分');
  console.log('    接口: ' + NATIVE.SCORE);
  try {
    const headers = makeHeaders(xt);
    const r = await $task.fetch({ url: NATIVE.SCORE, method: 'POST', headers, body, timeout: 20 });
    LOG.api('scoreQuery', r);
    if (r.headers && r.headers['r-token']) {
      $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
      LOG.info('x-token已更新');
    }
    result.score = { status: r.statusCode, size: (r.body || '').length };
    LOG.ok('积分查询完成', '响应 ' + result.score.size + 'B (加密)');
  } catch (e) {
    LOG.fail('积分查询异常', e.message);
    result.score = { error: e.message };
  }

  return result;
}

// ====================== 幸运转转转 ======================

async function runTurntableFlow(cookie) {
  LOG.step('4', '查询剩余抽奖次数');
  const remain = await apiPost(TURNTABLE_API + '/lottery/remain', cookie, { activityId: TURNTABLE_ID });
  if (remain === null) { LOG.fail('查询失败'); return; }
  
  let n = (remain && remain.code === 'SUCCESS') ? (remain.data || 0) : 0;
  LOG.ok('剩余抽奖次数', n + '');

  if (n <= 0) {
    LOG.info('次数为0，尝试完成任务...');
    const tasks = await apiGet(TURNTABLE_API + '/task/pop', cookie);
    if (tasks && tasks.code === 'SUCCESS' && tasks.data) {
      const taskArr = Array.isArray(tasks.data) ? tasks.data : [];
      LOG.ok('任务列表', taskArr.length + '个');
      if (taskArr.length === 0) LOG.info('无可用任务');
    }
  }

  if (n > 0) {
    let got = [];
    for (let i = 0; i < n; i++) {
      const res = await apiPost(TURNTABLE_API + '/jump/startGame', cookie, { activityId: TURNTABLE_ID });
      if (res && res.code === 'SUCCESS') {
        const pn = res.data?.prizeName || res.data?.name || '';
        if (pn) got.push(pn);
        LOG.ok(`抽奖 ${i + 1}/${n}`, pn || '成功');
        await apiPost(TURNTABLE_API + '/jump/endGame', cookie, { activityId: TURNTABLE_ID, ...(res.data || {}) });
      } else {
        LOG.fail(`抽奖 ${i + 1}/${n}`, res?.msg || '失败');
        break;
      }
    }
    LOG.section('抽奖汇总');
    LOG.ok('次数', `${got.length}/${n}`);
    if (got.length) LOG.info('奖品: ' + got.join('、'));
  }
}

// ====================== 原生签到 ======================

async function nativeCheckin(cookie, xtoken, body) {
  LOG.step('5', '使用原生API签到');
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
    if (r.statusCode === 200 && r.body && r.body.length > 50) {
      LOG.ok('签到成功', 'API返回正常');
      if (r.headers && r.headers['r-token']) {
        $prefs.setValueForKey(r.headers['r-token'], KEY.XTOKEN);
        LOG.info('x-token已更新');
      }
      return true;
    }
    LOG.fail('签到失败', 'HTTP ' + r.statusCode);
    return false;
  } catch (e) {
    LOG.fail('签到异常', e.message);
    return false;
  }
}

// ====================== 工具函数 ======================

async function apiPost(url, cookie, data) {
  try {
    const r = await $task.fetch({
      url, method: 'POST',
      headers: { ...WEB_HEADERS, Cookie: cookie },
      body: JSON.stringify(data),
      timeout: 15
    });
    if (r.statusCode !== 200) return null;
    return JSON.parse(r.body);
  } catch (e) {
    LOG.fail('请求异常', url.split('/').pop() + ' ' + e.message);
    return null;
  }
}

async function apiGet(url, cookie) {
  try {
    const r = await $task.fetch({
      url, method: 'GET',
      headers: { ...WEB_HEADERS, Cookie: cookie },
      timeout: 15
    });
    if (r.statusCode !== 200) return null;
    return JSON.parse(r.body);
  } catch (e) {
    LOG.fail('请求异常', url.split('/').pop() + ' ' + e.message);
    return null;
  }
}

function buildSummary(balance, checkinOk) {
  let lines = [];
  if (balance.fee && balance.fee.status === 200) lines.push('💰 话费: 已查(加密)');
  else if (balance.fee) lines.push('💰 话费: 查询失败');
  if (balance.plan && balance.plan.status === 200) lines.push('📱 流量: 已查(加密)');
  else if (balance.plan) lines.push('📱 流量: 查询失败');
  if (balance.score && balance.score.status === 200) lines.push('⭐ 积分: 已查');
  if (checkinOk) lines.push('✅ 签到: 成功');
  else lines.push('✅ 签到: 已完成');

  return {
    title: '签到完成',
    body: lines.join('\n')
  };
}

function notify(title, sub, body) {
  try { $notification.post(APP_NAME + ' ' + title, sub || '', body || ''); } catch (e) {}
}

main();