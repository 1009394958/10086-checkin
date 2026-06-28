// version=20260628.5
// 10086 Token 采集器 — for Quantumult X
//
// 重写规则（圈x → 重写 → 添加）:
//   ^https://wx\.10086\.cn/qwhdhub/user/info url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
//   ^https://wx\.10086\.cn/qwhdhub/.* url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
//
// MITM:
//   hostname = wx.10086.cn

(function () {
  // ---- 响应体模式：提取 Token ----
  if (typeof $response != "undefined" && $response) {
    try {
      var body = $response.body;
      var d = JSON.parse(body);
      var data = d.data || {};
      if (data.loginUid) {
        $prefs.setValueForKey(data.loginUid.trim(), "10086_qwhd_token");
        $notify("10086 ✓", "Token 获取成功", data.mobile || data.loginUid.substring(0, 30) + "...");
      }
    } catch (e) {}
    // 显式传回原始响应，圈x必认
    $done({body: $response.body, headers: $response.headers, status: $response.statusCode});
    return;
  }

  // ---- 请求头模式：采集 Cookie ----
  if (typeof $request != "undefined" && $request && $request.headers) {
    var ck = $request.headers["Cookie"] || $request.headers["cookie"] || "";
    if (ck.indexOf("QWHD") > -1) {
      var old = $prefs.valueForKey("10086_qwhd_cookie");
      if (old != ck) {
        $prefs.setValueForKey(ck, "10086_qwhd_cookie");
        $notify("10086 ✓", "Cookie 已更新", ck.substring(0, 40) + "...");
      }
    }
    $done({});
    return;
  }

  $done({});
})();