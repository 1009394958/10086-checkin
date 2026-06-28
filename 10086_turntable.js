/*
10086 幸运转转转 — for Quantumult X
====================================
自动完成任务 + 抽奖。需要先捕获 QWHD Cookie。
依赖: 10086_token_harvester.js 捕获的 Cookie

[rewrite_local]
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js

[task_local]
0 10 * * * https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_turntable.js, tag=10086转盘, enabled=true

[mitm]
hostname = wx.10086.cn
*/
(function () {
  var BASE = "https://wx.10086.cn/qwhdhub";
  var ck = $prefs.valueForKey("10086_qwhd_cookie") || "";

  if (!ck) {
    $notify("10086 转盘 ⚠️", "缺少 QWHD Cookie", "请先在 App 中打开转盘页面");
    $done(); return;
  }

  var HEADERS = {
    "Cookie": ck,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://wx.10086.cn/qwhdhub/turntable/1025041514"
  };

  var LOG = [];
  function log(m) { LOG.push(m); console.log(m); }

  async function main() {
    log("═══════════════════════════");
    log("  10086 幸运转转转");
    log("═══════════════════════════");

    // 1. 检查剩余次数
    log("\n📌 步骤1: 查询剩余抽奖次数");
    var remain = await apiPost("/lottery/remain", {});
    var n = (remain && remain.success) ? (remain.data || 0) : 0;
    log("  剩余次数: " + n);

    // 2. 如果没次数，做任务
    if (n <= 0) {
      log("\n📌 步骤2: 做任务增加次数");
      var tasks = await getTaskList();
      if (tasks && tasks.code === "SUCCESS" && tasks.data) {
        var list = Array.isArray(tasks.data) ? tasks.data : [];
        log("  任务数: " + list.length);
        for (var i = 0; i < list.length; i++) {
          var t = list[i];
          if (t.status === "UNDO" && t.todayRemain > 0) {
            log("  执行任务: " + (t.taskName || t.taskTitle || "任务" + (i + 1)));
            await doBrowseTask(t.id || t.taskId);
          }
        }
      }
      // 重新查次数
      remain = await apiPost("/lottery/remain", {});
      n = (remain && remain.success) ? (remain.data || 0) : 0;
      log("  做任务后剩余次数: " + n);
    }

    // 3. 抽奖
    if (n > 0) {
      log("\n📌 步骤3: 开始抽奖 x" + n);
      var prizes = [];
      for (var i = 0; i < n; i++) {
        log("  抽奖 " + (i + 1) + "/" + n);
        var res = await lotteryDraw();
        if (res && res.code === "SUCCESS") {
          var pn = res.data ? (res.data.prizeName || res.data.name || "已中奖") : "已中奖";
          prizes.push(pn);
          log("    ✓ " + pn);
        } else if (res && res.code === "DO_TASK") {
          log("    ⚠️ 需要做任务: " + (res.msg || ""));
          break;
        } else {
          log("    ✗ " + (res ? (res.msg || "失败") : "请求失败"));
          break;
        }
      }

      log("\n═══════════════════════════");
      log("  抽奖结果");
      log("  次数: " + prizes.length + "/" + n);
      if (prizes.length) log("  奖品: " + prizes.join("、"));
      log("═══════════════════════════");

      $notify("10086 转盘 ✓",
        "抽奖 " + prizes.length + "/" + n + " 次",
        prizes.length ? "奖品: " + prizes.join("、") : "未中奖");
    } else {
      log("\n⚠️ 没有抽奖次数");
      $notify("10086 转盘", "无抽奖次数", "任务可能已完成或暂无可做任务");
    }

    $done();
  }

  // POST /lottery/remain
  function apiPost(path, data) {
    try {
      var r = $task.fetch({
        url: BASE + path,
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(data || {}),
        timeout: 15
      });
      if (r.statusCode === 200) return JSON.parse(r.body);
      return null;
    } catch (e) {
      log("  API POST 失败: " + path + " → " + e.message);
      return null;
    }
  }

  // GET
  function apiGet(path) {
    try {
      var r = $task.fetch({
        url: BASE + path,
        method: "GET",
        headers: HEADERS,
        timeout: 15
      });
      if (r.statusCode === 200) {
        var ct = (r.headers["Content-Type"] || r.headers["content-type"] || "");
        if (ct.indexOf("json") !== -1) return JSON.parse(r.body);
        return { success: true, statusCode: r.statusCode };
      }
      if (r.statusCode === 302 || r.statusCode === 301) return { success: true, statusCode: r.statusCode };
      return null;
    } catch (e) {
      log("  API GET 失败: " + path + " → " + e.message);
      return null;
    }
  }

  function getTaskList() {
    return apiGet("/task/list?backUrl=" + encodeURIComponent(BASE + "/turntable/1025041514") + "&token=" + encodeURIComponent(ck));
  }

  function doBrowseTask(taskId) {
    return apiGet("/task/startBrowse/" + taskId);
  }

  function lotteryDraw() {
    return apiGet("/lottery/lotterySafely");
  }

  main();
})();
