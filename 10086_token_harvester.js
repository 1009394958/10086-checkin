/*
10086 转盘 Token — for Quantumult X
====================================
捕获 QWHD Cookie + Token
来源:
  - QWHD Cookie: 所有 wx.10086.cn 请求头
  - Token: /user/info 响应体的 loginUid 字段

[rewrite_local]
^https://wx\.10086\.cn/qwhdhub/user/info url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js

[mitm]
hostname = wx.10086.cn
*/
(function () {
  // ===== 请求头模式：捕获 Cookie =====
  if ($request && !$response) {
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
    return;
  }

  // ===== 响应体模式：从 /user/info 提取 loginUid = Token =====
  if ($response && $response.body) {
    try {
      var body = JSON.parse($response.body);
      if (body && body.success && body.data && body.data.loginUid) {
        var token = body.data.loginUid;
        var old = $prefs.valueForKey("10086_qwhd_token");
        if (old !== token) {
          $prefs.setValueForKey(token, "10086_qwhd_token");
          $notify("10086 转盘 ✓", "Token 已获取", token.substring(0, 40) + "...");
        }
      }
    } catch (e) {}
    $done($response);
    return;
  }

  $done({});
})();
