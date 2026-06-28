/*
 * Quantumult X - 10086 Token 读取/展示助手
 *
 * 在 Quantumult X 中作为脚本快捷方式运行，展示所有已捕获的 tokens
 *
 * 使用方式:
 *   Quantumult X 底部菜单 → 风车 → 快捷方式 → 添加 → 脚本 → 选择此文件
 */

const KEY_TOKENS = '10086_tokens';
const KEY_MIGU_TOKEN = '10086_migu_token';
const KEY_NOTE_TOKEN = '10086_note_token';
const KEY_COOKIES = '10086_cookies';

function readTokens() {
    const tokens = (() => {
        try { return JSON.parse($prefs.valueForKey(KEY_TOKENS) || '{}'); }
        catch (e) { return {}; }
    })();

    const miguData = (() => {
        try { return JSON.parse($prefs.valueForKey(KEY_MIGU_TOKEN) || '{}'); }
        catch (e) { return {}; }
    })();

    const noteToken = $prefs.valueForKey(KEY_NOTE_TOKEN) || '';
    const cookie = $prefs.valueForKey(KEY_COOKIES) || '';

    let output = '\n═══════════════════════════════════════\n';
    output += '       10086 Token 信息汇总\n';
    output += '═══════════════════════════════════════\n';

    // 主认证信息
    if (tokens.x_token || tokens.r_token || tokens.JSESSIONID) {
        output += '\n📌 主认证 (10086 COC)\n';
        output += '─────────────────────────────────────\n';
        if (tokens.x_token) {
            output += `  x-token:    ${tokens.x_token.substring(0, 64)}...\n`;
        }
        if (tokens.r_token) {
            output += `  r-token:    ${tokens.r_token}\n`;
        }
        if (tokens.JSESSIONID) {
            output += `  JSESSIONID: ${tokens.JSESSIONID}\n`;
        }
        if (tokens.UID) {
            output += `  UID:        ${tokens.UID}\n`;
        }
    }

    // 咪咕视频
    if (miguData.userToken || tokens.migu_userToken) {
        output += '\n🎬 咪咕视频\n';
        output += '─────────────────────────────────────\n';
        const ut = miguData.userToken || tokens.migu_userToken || '';
        output += `  userToken:  ${ut}\n`;
        if (miguData.userId)      output += `  userId:     ${miguData.userId}\n`;
        if (miguData.mobile)      output += `  手机号:     ${miguData.mobile}\n`;
        if (miguData.passId)      output += `  passId:     ${miguData.passId}\n`;
        if (miguData.expiredOn) {
            const exp = new Date(parseInt(miguData.expiredOn));
            output += `  过期时间:   ${exp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
            const now = new Date();
            const daysLeft = Math.floor((exp - now) / (86400000));
            if (daysLeft > 0) {
                output += `  剩余天数:   ${daysLeft} 天\n`;
            } else {
                output += `  ⚠️ 已过期!\n`;
            }
        }
    }

    // 139云笔记
    if (noteToken || tokens.NOTE_TOKEN) {
        output += '\n📝 139云笔记\n';
        output += '─────────────────────────────────────\n';
        const nt = noteToken || tokens.NOTE_TOKEN || '';
        output += `  NOTE_TOKEN: ${nt.substring(0, 48)}...\n`;
    }

    // Cookie
    if (cookie) {
        output += '\n🍪 Cookie\n';
        output += '─────────────────────────────────────\n';
        output += `  ${cookie.substring(0, 80)}...\n`;
    }

    // 状态
    output += '\n═══════════════════════════════════════\n';
    output += `  最后更新: ${tokens.last_updated || '未知'}\n`;
    output += `  脚本版本: 1.0.0\n`;
    output += '═══════════════════════════════════════\n';

    if (!tokens.x_token && !miguData.userToken) {
        output += '\n⚠️  尚未捕获到任何 Token\n';
        output += '请确保已正确配置 rewrite 并打开 10086 App 登录使用\n';
    }

    return output;
}

// 主执行
const output = readTokens();
console.log(output);

// 显示通知
$notification.post(
    '10086 Token 状态',
    `咪咕Token: ${(JSON.parse($prefs.valueForKey(KEY_MIGU_TOKEN) || '{}').userToken || '未捕获')}`,
    `x-token: ${(JSON.parse($prefs.valueForKey(KEY_TOKENS) || '{}').x_token || '未捕获').substring(0, 20)}...`
);

$done();