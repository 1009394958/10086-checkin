/*
10086 转盘 Token 查看 — for Quantumult X
========================================
在 Quantumult X 中添加为快捷方式运行，查看转盘 QWHD Cookie。
*/
(function () {
  var ck = $prefs.valueForKey("10086_qwhd_cookie") || "";
  var out = "\n═══════════════════════════\n";
  out += "   10086 转盘 Token 信息\n";
  out += "═══════════════════════════\n";
  if (ck) {
    out += "\n  ✅ QWHD Cookie:\n";
    out += "  " + ck + "\n";
    var uid = (ck.match(/UID=([^;]+)/) || [])[1] || "";
    var qwhd = (ck.match(/QWHD=([^;]+)/) || [])[1] || "";
    if (uid) out += "\n  UID:  " + uid + "\n";
    if (qwhd) out += "  QWHD: " + qwhd + "\n";
  } else {
    out += "\n  ⚠️ 未捕获到 QWHD Cookie\n";
    out += "  请在中国移动App中打开转盘页面\n";
  }
  out += "\n═══════════════════════════\n";
  console.log(out);
  $notify("10086 转盘", ck ? "QWHD Cookie 已就绪" : "未捕获 QWHD Cookie", ck ? ck.substring(0, 30) + "..." : "请在App中打开转盘");
  $done();
})();
