/*
10086 Token 捕获 — for Quantumult X
==================================
[rewrite_local]
# 方式1：从响应体提取（推荐 - 捕获咪咕userToken/139 NOTE_TOKEN）
^https://(api\.miguvideo\.com/user/v1/user-info|note\.mcloud\.139\.com/noteServer/api/authTokenRefresh) url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
# 方式2：从请求头提取（捕获 x-token、Cookie）
^https://(.*\.)?(coc\.10086\.cn|10086\.cn|miguvideo\.com|139\.com|cmpassport\.com) url script-request-header https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
# 方式3：从响应头提取（捕获 r-token）
^https://(.*\.)?(coc\.10086\.cn|10086\.cn|miguvideo\.com|139\.com|cmpassport\.com) url script-response-body https://raw.githubusercontent.com/1009394958/10086-checkin/main/10086_token_harvester.js
[mitm]
hostname = *.coc.10086.cn, *.10086.cn, *.miguvideo.com, *.139.com, *.cmpassport.com, api.miguvideo.com, *.mcloud.139.com
*/
const TK = {
  XTOKEN: "10086_xtoken", RTOKEN: "10086_rtoken",
  COOKIE: "10086_cookie", MIGU: "10086_migu_token",
  NOTE: "10086_note_token"
};
(function () {
  // ---- script-response-body: 从响应体提取 ----
  if (typeof $response !== "undefined" && $response) {
    var url = ($request && $request.url) || "";
    var hd = $response.headers || {};
    // 提取 r-token
    if (hd["r-token"]) {
      $prefs.setValueForKey(hd["r-token"], TK.RTOKEN);
      $prefs.setValueForKey(hd["r-token"], TK.XTOKEN);
    }
    // 提取 Set-Cookie
    if (hd["Set-Cookie"]) {
      var sc = hd["Set-Cookie"];
      var jsid = (sc.match(/JSESSIONID=([^;]+)/) || [])[1];
      var uid = (sc.match(/UID=([^;]+)/) || [])[1];
      if (jsid || uid) {
        var old = $prefs.valueForKey(TK.COOKIE) || "";
        if (jsid) old = old.includes("JSESSIONID=") ? old.replace(/JSESSIONID=[^;]+/, "JSESSIONID=" + jsid) : "JSESSIONID=" + jsid + "; " + old;
        if (uid) old = old.includes("UID=") ? old.replace(/UID=[^;]+/, "UID=" + uid) : "UID=" + uid + "; " + old;
        $prefs.setValueForKey(old, TK.COOKIE);
      }
    }
    // 解析响应体 JSON 提取 token
    try {
      var body = typeof $response.body === "string" ? $response.body : JSON.stringify($response.body);
      if (body && body.charAt(0) === "{") {
        var d = JSON.parse(body);
        // 咪咕视频 userToken
        if (d.userInfo && d.userInfo.userToken) {
          var migu = {
            userToken: d.userInfo.userToken,
            userId: d.userInfo.userId,
            mobile: d.userInfo.blurMobile || d.userInfo.mobile,
            expiredOn: d.userInfo.expiredOn,
            passId: d.userInfo.passId
          };
          $prefs.setValueForKey(JSON.stringify(migu), TK.MIGU);
          var exp = d.userInfo.expiredOn ? new Date(parseInt(d.userInfo.expiredOn)).toLocaleString("zh-CN") : "未知";
          $notify("10086 Token ✓", "咪咕 userToken 已捕获", "有效期: " + exp);
        }
      }
    } catch (e) {}
    $done({});
    return;
  }
  // ---- script-request-header: 从请求头提取 ----
  if (typeof $request !== "undefined" && $request && $request.headers) {
    var hd = $request.headers;
    var url = $request.url || "";
    // 提取 x-token
    if (hd["x-token"]) {
      var old = $prefs.valueForKey(TK.XTOKEN);
      if (old !== hd["x-token"]) {
        $prefs.setValueForKey(hd["x-token"], TK.XTOKEN);
        $notify("10086 Token ✓", "x-token 已更新", hd["x-token"].substring(0, 24) + "...");
      }
    }
    // 提取 Cookie
    if (hd["Cookie"]) {
      $prefs.setValueForKey(hd["Cookie"], TK.COOKIE);
    }
    // 提取 NOTE_TOKEN (139云笔记)
    if (hd["NOTE_TOKEN"]) {
      $prefs.setValueForKey(hd["NOTE_TOKEN"], TK.NOTE);
    }
    // 提取 userToken (咪咕请求头)
    if (hd["userToken"]) {
      try {
        var oldMig = JSON.parse($prefs.valueForKey(TK.MIGU) || "{}");
        if (oldMig.userToken !== hd["userToken"]) {
          oldMig.userToken = hd["userToken"];
          $prefs.setValueForKey(JSON.stringify(oldMig), TK.MIGU);
        }
      } catch (e) {}
    }
    $done({});
    return;
  }
  $done({});
})();
