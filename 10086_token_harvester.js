// version=20260628.4
// 10086 Token 采集器 — for Quantumult X
// 添加到重写规则：
// ^https://wx\.10086\.cn/qwhdhub/user/info url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
// ^https://wx\.10086\.cn/qwhdhub/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js

const TOKEN_KEY = "10086_qwhd_token";
const COOKIE_KEY = "10086_qwhd_cookie";

(function () {
  // 响应体模式：从 /user/info 提取 loginUid 作为 Token
  if (typeof $response !== "undefined" && $response) {
    try {
      var body = typeof $response.body === "string" ? $response.body : JSON.stringify($response.body);
      var d = JSON.parse(body);
      var data = d.data || {};
      var token = data.loginUid || null;
      var mobile = data.mobile || "";
      if (token) {
        $prefs.setValueForKey(token.trim(), TOKEN_KEY);
        $notify("10086 ✓", "Token 获取成功", mobile || token.substring(0, 30) + "...");
      }
    } catch (e) {
      console.log("Token 解析异常: " + e.message);
    }
    $done($response);
    return;
  }

  // 请求头模式：采集 Cookie
  if (typeof $request !== "undefined" && $request && $request.headers) {
    var cookie = $request.headers["Cookie"] || $request.headers["cookie"] || "";
    if (cookie.indexOf("QWHD") !== -1) {
      var old = $prefs.valueForKey(COOKIE_KEY);
      if (old !== cookie) {
        $prefs.setValueForKey(cookie, COOKIE_KEY);
        $notify("10086 ✓", "Cookie 已更新", cookie.substring(0, 40) + "...");
      }
    }
    $done({});
    return;
  }

  $done({});
})();