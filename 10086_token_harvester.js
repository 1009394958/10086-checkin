/*
10086 转盘 Cookie — for Quantumult X
====================================
[rewrite_local]
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
[mitm]
hostname = wx.10086.cn
*/
const KEY = "10086_qwhd_cookie";
(function () {
  if (typeof $request === "undefined" || !$request) { $done({}); return; }
  var ck = $request.headers["Cookie"] || "";
  if (!ck) { $done({}); return; }
  var old = $prefs.valueForKey(KEY);
  if (old !== ck) {
    $prefs.setValueForKey(ck, KEY);
    $notify("10086 转盘 ✓", "Cookie 已捕获", ck.substring(0, 40) + "...");
  }
  $done({});
})();