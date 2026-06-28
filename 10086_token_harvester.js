/*
10086 转盘 Token — for Quantumult X
====================================
[rewrite_local]
# 方式1：从 /user/info 响应提取 Token
^https://wx\.10086\.cn/qwhdhub/user/info url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
# 方式2：从请求 Cookie 提取
^https://wx\.10086\.cn/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
[mitm]
hostname = wx.10086.cn
*/
const TOKEN_KEY = "10086_qwhd_token";
const COOKIE_KEY = "10086_qwhd_cookie";
(function () {
  if (typeof $response !== "undefined" && $response) {
    console.log("===== 10086 Token(response) =====");
    try {
      var body = typeof $response.body === "string" ? $response.body : JSON.stringify($response.body);
      var d = JSON.parse(body);
      var data = d.data || {};
      var token = data.loginUid || null;
      var mobile = data.mobile || "";
      if (token) {
        $prefs.setValueForKey(token.trim(), TOKEN_KEY);
        $notify("10086 转盘 ✓", mobile ? mobile : "Token 获取成功", token.substring(0, 20) + "...");
      }
    } catch (e) {
      console.log("10086 Token 解析异常: " + e.message);
    }
    $done({});
    return;
  }
  if (typeof $request !== "undefined" && $request && $request.headers) {
    var cookie = $request.headers["Cookie"] || $request.headers["cookie"] || "";
    if (cookie.indexOf("QWHD") !== -1) {
      var old = $prefs.valueForKey(COOKIE_KEY);
      if (old !== cookie) {
        $prefs.setValueForKey(cookie, COOKIE_KEY);
        $notify("10086 转盘 ✓", "QWHD Cookie 已更新", cookie.substring(0, 40) + "...");
      }
    }
    $done({});
    return;
  }
  $done({});
})();