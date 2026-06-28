/*
10086 幸运转转转 — for Quantumult X
====================================
自动做浏览任务 + 抽奖。
需要: 10086_token_harvester.js 捕获的 QWHD Cookie + URL Token

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
  var tk = $prefs.valueForKey("10086_qwhd_token") || "";

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
  var COOKIE_KEYS = ["QWHD_SESSION_TOKEN", "yx", "touch_id", "grayscale"];

  var LOG = [];
  function log(m) { LOG.push(m); console.log(m); }

  // 从响应头更新 Cookie
  function updateCookie(hd) {
    var sc = hd["Set-Cookie"] || "";
    if (!sc) return;
    var changed = false;
    for (var i = 0; i < COOKIE_KEYS.length; i++) {
      var re = new RegExp(COOKIE_KEYS[i] + "=([^;]+)");
      var m = sc.match(re);
      if (m) {
        var nv = COOKIE_KEYS[i] + "=" + m[1];
        if (ck.indexOf(COOKIE_KEYS[i] + "=") !== -1) {
          ck = ck.replace(new RegExp(COOKIE_KEYS[i] + "=[^;]+"), nv);
        } else {
          ck = nv + "; " + ck;
        }
        changed = true;
      }
    }
    if (changed) {
      $prefs.setValueForKey(ck, "10086_qwhd_cookie");
      HEADERS["Cookie"] = ck;
    }
  }

  async function main() {
    log("═══════════════════════════");
    log("  10086 幸运转转转");
    if (tk) log("  Token: " + tk.substring(0, 24) + "...");
    log("═══════════════════════════");

    // 1. 查用户信息
    var userInfo = await apiGet("/user/info");
    if (userInfo && userInfo.success) {
      var mobile = userInfo.data.nickName || userInfo.data.mobile || "";
      log("  用户: " + mobile);
    }

    // 2. 查剩余次数
    log("\n📌 步骤1: 查询剩余抽奖次数");
    var remain = await apiPost("/lottery/remain", {});
    var n = (remain && remain.success) ? (remain.data || 0) : 0;
    log("  剩余次数: " + n);

    // 3. 如果没次数，做任务
    if (n <= 0) {
      log("\n📌 步骤2: 做任务增加次数");
      var tasksData = await apiGet("/task/list?backUrl=" + encodeURIComponent(BASE + "/turntable/1025041514") + "&token=" + encodeURIComponent(tk || ""));
      if (tasksData && tasksData.code === "SUCCESS" && tasksData.data) {
        var list = Array.isArray(tasksData.data) ? tasksData.data : [];
        log("  任务数: " + list.length);
        for (var i = 0; i < list.length; i++) {
          var t = list[i];
          if (t.taskStage === "UNDO" && t.todayRemain > 0) {
            log("  执行任务: " + t.name);
            await doBrowseTaskByUrl(t.url);
          }
        }
      } else {
        log("  ⚠️ 获取任务列表失败" + (tk ? "" : "，缺少 URL token"));
        log("  提示: 重新在 App 中打开转盘页面以捕获 token");
      }
      // 重新查次数
      remain = await apiPost("/lottery/remain", {});
      n = (remain && remain.success) ? (remain.data || 0) : 0;
      log("  做任务后剩余次数: " + n);
    }

    // 4. 抽奖
    if (n > 0) {
      log("\n📌 步骤3: 开始抽奖 x" + n);
      var prizes = [];
      for (var i = 0; i < n; i++) {
        log("  抽奖 " + (i + 1) + "/" + n);
        var res = await apiGet("/lottery/lotterySafely");
        if (res && res.code === "SUCCESS") {
          var pn = res.data ? (res.data.prizeName || res.data.name || "已中奖") : "已中奖";
          prizes.push(pn);
          log("    ✓ " + pn);
        } else if (res && res.code === "DO_TASK") {
          log("    ⚠️ 需要做任务: " + (res.msg || ""));
          if (res.data && res.data.url) {
            log("  直接执行 lotterySafely 返回的任务...");
            await doBrowseTaskByUrl(res.data.url);
            i--;
            continue;
          }
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

  function apiPost(path, data) {
    try {
      var r = $task.fetch({
        url: BASE + path,
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(data || {}),
        timeout: 15
      });
      if (r.statusCode === 200) {
        updateCookie(r.headers);
        return JSON.parse(r.body);
      }
      return null;
    } catch (e) {
      log("  POST 失败: " + path + " → " + e.message);
      return null;
    }
  }

  function apiGet(path) {
    try {
      var fullUrl = path.indexOf("http") === 0 ? path : BASE + path;
      var r = $task.fetch({
        url: fullUrl,
        method: "GET",
        headers: HEADERS,
        timeout: 15
      });
      if (r.statusCode === 200) {
        updateCookie(r.headers);
        var ct = (r.headers["Content-Type"] || r.headers["content-type"] || "");
        if (ct.indexOf("json") !== -1) return JSON.parse(r.body);
        return null;
      }
      return null;
    } catch (e) {
      log("  GET 失败: " + path.substring(0, 60) + "… → " + e.message);
      return null;
    }
  }

  // 执行浏览任务：使用完整 task.url，跟随所有 302 重定向
  function doBrowseTaskByUrl(url) {
    try {
      log("    URL: " + url.substring(0, 60) + "...");
      var r = $task.fetch({
        url: url.indexOf("http") === 0 ? url : (BASE + url),
        method: "GET",
        headers: HEADERS,
        timeout: 15,
        "auto-redirect": false
      });
      updateCookie(r.headers);

      var loc = r.headers["Location"];
      var followed = 0;
      while (loc && followed < 3) {
        log("    跟随 → " + loc.substring(0, 60) + "...");
        r = $task.fetch({
          url: loc,
          method: "GET",
          headers: HEADERS,
          timeout: 10,
          "auto-redirect": false
        });
        followed++;
        loc = r.headers["Location"];
      }
      log("    ✓ 浏览任务完成 (跟随 " + followed + " 次跳转)");
      return { success: true };
    } catch (e) {
      log("    浏览任务失败: " + e.message);
      return null;
    }
  }

  main();
})();
