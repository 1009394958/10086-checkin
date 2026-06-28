/*
10086 幸运转转转 — for Quantumult X
====================================
自动做浏览任务 + 抽奖。
Token 从 /user/info 响应中的 loginUid 字段自动获取

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
  var API_COUNT = 0;
  function log(m) { LOG.push(m); console.log(m); }
  function sep() { log("───────────────────────────────────"); }

  // 格式化 JSON 为单行字符串
  function fmt(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "string") return v.length > 120 ? v.substring(0, 120) + "…" : v;
    try { var s = JSON.stringify(v); return s.length > 300 ? s.substring(0, 300) + "…" : s; } catch(e) { return String(v); }
  }

  // 从响应头更新 Cookie
  function updateCookie(hd) {
    var sc = hd["Set-Cookie"] || "";
    if (!sc) return;
    var changed = false;
    var updated = [];
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
        updated.push(COOKIE_KEYS[i]);
      }
    }
    if (changed) {
      $prefs.setValueForKey(ck, "10086_qwhd_cookie");
      HEADERS["Cookie"] = ck;
      log("    ← Cookie 刷新: " + updated.join(", "));
    }
  }

  // POST → JSON
  function apiPost(path, data) {
    API_COUNT++;
    var id = "#" + API_COUNT;
    try {
      log("  " + id + " POST " + path);
      var r = $task.fetch({
        url: BASE + path,
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(data || {}),
        timeout: 15
      });
      log("  " + id + " → HTTP " + r.statusCode);
      if (r.statusCode === 200) {
        updateCookie(r.headers);
        var res = JSON.parse(r.body);
        log("  " + id + " → body: " + fmt(res));
        return res;
      }
      log("  " + id + " → 非 200, body: " + (r.body ? r.body.substring(0, 200) : "空"));
      return null;
    } catch (e) {
      log("  " + id + " ✗ 异常: " + e.message);
      return null;
    }
  }

  // GET → JSON
  function apiGet(path) {
    API_COUNT++;
    var id = "#" + API_COUNT;
    try {
      var fullUrl = path.indexOf("http") === 0 ? path : BASE + path;
      var shortUrl = path.indexOf("http") === 0 ? path.substring(0, 80) + "…" : path;
      log("  " + id + " GET " + shortUrl);
      var r = $task.fetch({
        url: fullUrl,
        method: "GET",
        headers: HEADERS,
        timeout: 15
      });
      log("  " + id + " → HTTP " + r.statusCode);
      if (r.statusCode === 200) {
        updateCookie(r.headers);
        var ct = (r.headers["Content-Type"] || r.headers["content-type"] || "");
        if (ct.indexOf("json") !== -1) {
          var res = JSON.parse(r.body);
          log("  " + id + " → body: " + fmt(res));
          return res;
        }
        log("  " + id + " → Content-Type=" + ct + ", body=" + (r.body ? r.body.substring(0, 100) : "空"));
        return null;
      }
      log("  " + id + " → 非 200, body: " + (r.body ? r.body.substring(0, 200) : "空"));
      if (r.statusCode === 302 || r.statusCode === 301) {
        var loc = r.headers["Location"] || "";
        log("  " + id + " → Location: " + loc.substring(0, 100));
        return { success: true, statusCode: r.statusCode };
      }
      return null;
    } catch (e) {
      log("  " + id + " ✗ 异常: " + e.message);
      return null;
    }
  }

  // 执行浏览任务：使用完整 task.url，跟随所有 302 重定向
  function doBrowseTaskByUrl(url) {
    API_COUNT++;
    var id = "#" + API_COUNT;
    try {
      var fullUrl = url.indexOf("http") === 0 ? url : (BASE + url);
      log("  " + id + " GET browse: " + fullUrl.substring(0, 100) + "…");
      var r = $task.fetch({
        url: fullUrl,
        method: "GET",
        headers: HEADERS,
        timeout: 15,
        "auto-redirect": false
      });
      log("  " + id + " → HTTP " + r.statusCode);
      updateCookie(r.headers);

      var loc = r.headers["Location"];
      var followed = 0;
      while (loc && followed < 3) {
        var stepId = "  " + id + "→L" + (followed + 1);
        log(stepId + " GET " + loc.substring(0, 100) + "…");
        r = $task.fetch({
          url: loc,
          method: "GET",
          headers: HEADERS,
          timeout: 10,
          "auto-redirect": false
        });
        log(stepId + " → HTTP " + r.statusCode);
        followed++;
        loc = r.headers["Location"];
      }
      if (followed === 0) log("  " + id + " → 无重定向, 直接完成");
      else log("  " + id + " → 共跟随 " + followed + " 次跳转 ✓");
      return { success: true };
    } catch (e) {
      log("  " + id + " ✗ 异常: " + e.message);
      return null;
    }
  }

  // ======== 主流程 ========
  async function main() {
    log("╔══════════════════════════════════╗");
    log("║      10086 幸运转转转            ║");
    log("╚══════════════════════════════════╝");
    log("Cookie: " + ck.substring(0, 50) + "…");
    log("Token:  " + (tk ? tk.substring(0, 30) + "…" : "（空）"));
    log("Referer: " + HEADERS["Referer"]);
    sep();

    // ─── 1. 用户信息 ───
    log("\n▶▶ 步骤1/4: 获取用户信息");
    var userInfo = await apiGet("/user/info");
    if (userInfo && userInfo.success) {
      var d = userInfo.data || {};
      log("   ├─ mobile:     " + (d.mobile || "—"));
      log("   ├─ nickName:   " + (d.nickName || "—"));
      log("   ├─ province:   " + (d.provinceCode || "—"));
      log("   ├─ loginUid:   " + (d.loginUid ? d.loginUid.substring(0, 40) + "…" : "—"));
      log("   └─ registerDate: " + (d.registerDate || "—"));
      if (d.loginUid) {
        tk = d.loginUid;
        $prefs.setValueForKey(tk, "10086_qwhd_token");
        log("  ✔ Token 已从 loginUid 提取并存储");
      }
    } else {
      log("  ✗ 获取用户信息失败");
    }
    sep();

    // ─── 2. 查剩余次数 ───
    log("\n▶▶ 步骤2/4: 查询剩余抽奖次数");
    var remain = await apiPost("/lottery/remain", {});
    var n = 0;
    if (remain && remain.success) {
      n = remain.data || 0;
      log("  ✔ 剩余抽奖次数: " + n);
    } else {
      log("  ✗ 查询失败, 响应=" + fmt(remain));
    }
    sep();

    // ─── 3. 做任务 ───
    if (n <= 0) {
      log("\n▶▶ 步骤3/4: 做任务增加抽奖次数");
      log("  Token=" + (tk ? tk.substring(0, 24) + "…" : "空"));
      if (!tk) {
        log("  ⚠ Token 为空，无法获取任务列表");
        log("  提示: 请在 App 中打开转盘页面以生成 Token，或确认 /user/info 返回了 loginUid");
      }
      var tasksData = await apiGet("/task/list?backUrl=" + encodeURIComponent(BASE + "/turntable/1025041514") + "&token=" + encodeURIComponent(tk || ""));
      if (tasksData && tasksData.code === "SUCCESS" && tasksData.data) {
        var list = Array.isArray(tasksData.data) ? tasksData.data : [];
        log("  共 " + list.length + " 个任务:");
        for (var i = 0; i < list.length; i++) {
          var t = list[i];
          log("  ─── 任务 " + (i + 1) + " ───");
          log("     taskId:      " + (t.taskId || t.id || "—"));
          log("     name:        " + t.name);
          log("     type:        " + (t.type || "—"));
          log("     stage:       " + t.taskStage);
          log("     todayRemain: " + (t.todayRemain !== undefined ? t.todayRemain : "—"));
          log("     earnChance:  " + (t.earnOpportunity !== undefined ? t.earnOpportunity : "—"));
          log("     url:         " + (t.url ? t.url.substring(0, 80) + "…" : "—"));
          log("     redirect:    " + (t.redirect || "—"));
          log("     targetUrl:   " + (t.targetUrl ? t.targetUrl.substring(0, 80) + "…" : "—"));

          if (t.taskStage === "UNDO" && t.todayRemain > 0) {
            sep();
            log("  → 执行浏览任务: " + t.name);
            var ok = await doBrowseTaskByUrl(t.url);
            if (ok) log("  ✔ " + t.name + " 完成");
            else log("  ✗ " + t.name + " 执行失败");
          } else {
            log("  → 跳过 (stage=" + t.taskStage + ", remain=" + t.todayRemain + ")");
          }
        }
      } else {
        if (tasksData) {
          log("  ✗ 获取任务列表失败: code=" + tasksData.code + ", msg=" + (tasksData.msg || "—"));
        } else {
          log("  ✗ 获取任务列表失败（API 返回空）");
        }
      }

      // 重新查次数
      sep();
      log("  → 重新查询抽奖次数…");
      remain = await apiPost("/lottery/remain", {});
      if (remain && remain.success) {
        n = remain.data || 0;
      }
      log("  ✔ 做任务后剩余次数: " + n);
    } else {
      log("\n▶▶ 步骤3/4: 已有抽奖次数，跳过做任务");
    }
    sep();

    // ─── 4. 抽奖 ───
    if (n > 0) {
      log("\n▶▶ 步骤4/4: 开始抽奖 (" + n + " 次)");
      var prizes = [];
      var drawCount = 0;
      for (var i = 0; i < n; i++) {
        drawCount++;
        log("  ─── 第 " + drawCount + "/" + n + " 次抽奖 ───");
        var res = await apiGet("/lottery/lotterySafely");
        if (res && res.code === "SUCCESS") {
          var pn = res.data ? (res.data.prizeName || res.data.name || "已中奖") : "已中奖";
          prizes.push(pn);
          log("  ✔ 中奖: " + pn);
          if (res.data) log("     data: " + fmt(res.data));
        } else if (res && res.code === "DO_TASK") {
          log("  ⚠ 需要做任务: " + (res.msg || ""));
          log("     data: " + fmt(res.data));
          if (res.data && res.data.url) {
            log("  → 执行 lotterySafely 返回的任务…");
            var ok = await doBrowseTaskByUrl(res.data.url);
            if (ok) {
              log("  ✔ 任务完成，重新抽奖");
              i--;
              continue;
            }
          }
          log("  ✗ 没有可执行的任务或任务执行失败，停止抽奖");
          break;
        } else if (res && res.code === "NOT_LOGIN") {
          log("  ✗ 登录失效 (NOT_LOGIN)");
          break;
        } else if (res && res.code === "NO_CHANCE") {
          log("  ✗ 无抽奖机会 (NO_CHANCE)");
          break;
        } else {
          log("  ✗ 抽奖失败: " + (res ? (res.msg || "code=" + res.code) : "API 无响应"));
          break;
        }
      }

      log("\n═══════════ 抽奖结果 ═══════════");
      log("  实抽 " + prizes.length + "/" + n + " 次");
      if (prizes.length) {
        log("  奖品:");
        for (var j = 0; j < prizes.length; j++) {
          log("    " + (j + 1) + ". " + prizes[j]);
        }
      } else {
        log("  未中奖");
      }
      log("═══════════════════════════════");

      $notify("10086 转盘 ✓",
        "抽奖 " + prizes.length + "/" + n + " 次",
        prizes.length ? "奖品: " + prizes.join("、") : "未中奖");
    } else {
      log("\n▶▶ 步骤4/4: 跳过（无抽奖次数）");
      log("\n⚠️ 没有抽奖次数");
      $notify("10086 转盘", "无抽奖次数", "任务可能已完成或暂无可做任务");
    }

    log("\n═══════════ 运行完成 ═══════════");
    log("  共发起 " + API_COUNT + " 次 API 请求");
    log("═══════════════════════════════");
    $done();
  }

  main();
})();
