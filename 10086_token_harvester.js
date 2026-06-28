// version=20260628.3
/*
10086 转盘 Token 采集器 — for Quantumult X
===========================================
请订阅重写规则（不要直接添加此 JS 为订阅）：
https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_qwhd_rewrite.conf
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
    // 透传原始响应，否则页面会白屏
    $done($response);
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