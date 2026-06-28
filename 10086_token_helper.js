/*
10086 Token 查看 — for Quantumult X
==================================
在 Quantumult X 中添加为快捷方式运行，查看已捕获的所有 Token 信息。
*/
(function () {
  var xtk = $prefs.valueForKey("10086_xtoken") || "";
  var rtk = $prefs.valueForKey("10086_rtoken") || "";
  var ck = $prefs.valueForKey("10086_cookie") || "";
  var migu = (function () { try { return JSON.parse($prefs.valueForKey("10086_migu_token") || "{}"); } catch (e) { return {}; } })();
  var note = $prefs.valueForKey("10086_note_token") || "";
  var last = $prefs.valueForKey("10086_last_update") || "";

  var out = "\n════════════════════════════════\n";
  out += "     10086 Token 信息汇总\n";
  out += "════════════════════════════════\n";

  if (xtk || rtk) {
    out += "\n  📌 主认证\n";
    out += "  ───────────────────────────────\n";
    if (xtk) out += "  x-token:     " + xtk.substring(0, 48) + "...\n";
    if (rtk) out += "  r-token:     " + rtk + "\n";
  }

  if (ck) {
    var jsid = (ck.match(/JSESSIONID=([^;]+)/) || [])[1] || "";
    var uid = (ck.match(/UID=([^;]+)/) || [])[1] || "";
    if (jsid) out += "  JSESSIONID:  " + jsid + "\n";
    if (uid) out += "  UID:         " + uid + "\n";
  }

  if (migu.userToken) {
    out += "\n  🎬 咪咕视频\n";
    out += "  ───────────────────────────────\n";
    out += "  userToken:   " + migu.userToken + "\n";
    if (migu.userId) out += "  userId:      " + migu.userId + "\n";
    if (migu.mobile) out += "  手机号:      " + migu.mobile + "\n";
    if (migu.expiredOn) {
      var exp = new Date(parseInt(migu.expiredOn));
      out += "  过期:        " + exp.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
      var d = Math.floor((exp - new Date()) / 86400000);
      out += "  剩余:        " + (d > 0 ? d + " 天" : "已过期") + "\n";
    }
  }

  if (note) {
    out += "\n  📝 139云笔记\n";
    out += "  ───────────────────────────────\n";
    out += "  NOTE_TOKEN:  " + note.substring(0, 40) + "...\n";
  }

  if (!xtk && !migu.userToken) {
    out += "\n  ⚠️ 尚未捕获到任何 Token\n";
    out += "  请打开 10086 App 并完成登录\n";
  }

  out += "\n════════════════════════════════\n";
  console.log(out);

  $notify("10086 Token 状态",
    migu.userToken ? "咪咕Token: " + migu.userToken.substring(0, 16) + "..." : "未捕获咪咕Token",
    xtk ? "x-token: " + xtk.substring(0, 20) + "..." : "未捕获 x-token"
  );
  $done();
})();
