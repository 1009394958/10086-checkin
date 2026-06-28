/*
10086 转盘 Token — for Quantumult X
====================================
[rewrite_local]
# 捕获转盘 QWHD Cookie（打开转盘页面时自动截获）
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
[mitm]
hostname = wx.10086.cn
*/
(function () {
  if (!$request || !$request.headers) { $done({}); return; }
  var hd = $request.headers;
  var ck = hd["Cookie"] || hd["cookie"] || "";
  if (ck && ck.indexOf("QWHD") !== -1) {
    var old = $prefs.valueForKey("10086_qwhd_cookie");
    if (old !== ck) {
      $prefs.setValueForKey(ck, "10086_qwhd_cookie");
      $notify("10086 转盘 ✓", "QWHD Cookie 已捕获", ck.substring(0, 40) + "...");
    }
  }
  $done({});
})();
