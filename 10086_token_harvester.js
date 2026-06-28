/*
10086 转盘 Token — for Quantumult X
====================================
捕获 QWHD Cookie + URL token（从转盘页面 URL 中提取）
[rewrite_local]
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
[mitm]
hostname = wx.10086.cn
*/
(function () {
  if (!$request) { $done({}); return; }

  // 捕获 Cookie
  var hd = $request.headers;
  var ck = hd["Cookie"] || hd["cookie"] || "";
  if (ck && ck.indexOf("QWHD") !== -1) {
    var old = $prefs.valueForKey("10086_qwhd_cookie");
    if (old !== ck) {
      $prefs.setValueForKey(ck, "10086_qwhd_cookie");
      $notify("10086 转盘 ✓", "QWHD Cookie 已捕获", ck.substring(0, 40) + "...");
    }
  }

  // 捕获 URL token（从转盘页面 URL 中提取 token=xxx）
  var url = $request.url || "";
  var m = url.match(/[?&]token=([^&]+)/);
  if (m) {
    var t = decodeURIComponent(m[1]);
    var oldT = $prefs.valueForKey("10086_qwhd_token");
    if (oldT !== t) {
      $prefs.setValueForKey(t, "10086_qwhd_token");
    }
  }

  $done({});
})();
