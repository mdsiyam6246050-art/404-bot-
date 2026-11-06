
"use strict";

const TelegramAPI = require("./api");
const path = require("path");
const fs = require("fs");

let telegram = null;
let telegramToken = null;

const STATE_PATH = path.join(
  __dirname,
  "../../data/telegram-alert-state.json"
);

// প্রতিটি নোটিফিকেশনের আলাদা ডিজাইন, আলাদা ইমোজি ও বাংলা-ইংরেজি লেখা।
const ALERT_DESIGNS = {
  startup: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🚀 𝗕𝗢𝗧 𝗦𝗧𝗔𝗥𝗧𝗘𝗗
» 🤖 𝗕𝗢𝗧 𝗡𝗔𝗠𝗘 : ${d.name || "Messenger Bot"}
» 🟢 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗡𝗟𝗜𝗡𝗘 | সচল আছে
» ⚙️ 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 : ${d.details || "বট সফলভাবে চালু হয়েছে"}
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  messengerStart: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 💬 𝗠𝗘𝗦𝗦𝗘𝗡𝗚𝗘𝗥 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗
» 👤 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 : ${d.account || "Facebook Account"}
» 🆔 𝗨𝗜𝗗 : ${d.uid || "N/A"}
» 🔗 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗜𝗢𝗡 : 𝗦𝗨𝗖𝗖𝗘𝗦𝗦 | সফল
» 🟢 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗔𝗖𝗧𝗜𝗩𝗘 | চালু আছে
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  restart: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🔄 𝗕𝗢𝗧 𝗥𝗘𝗦𝗧𝗔𝗥𝗧𝗘𝗗
» 💋 বট আবার চালু হয়েছে
» 🛠️ 𝗥𝗘𝗔𝗦𝗢𝗡 : ${d.reason || "প্রসেস পুনরায় চালু হয়েছে"}
» ⏱️ 𝗧𝗜𝗠𝗘 : ${d.time || new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
» 🟢 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗥𝗨𝗡𝗡𝗜𝗡𝗚 | চলছে
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  logout: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🚪 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗟𝗢𝗚𝗢𝗨𝗧
» 😫 আইডি লগআউট হয়েছে
» 👤 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 : ${d.account || "Facebook"}
» 🆔 𝗨𝗜𝗗 : ${d.uid || "N/A"}
» ❌ 𝗣𝗥𝗢𝗕𝗟𝗘𝗠 : 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗡𝗗𝗘𝗗 | সেশন শেষ
» 🔐 𝗔𝗖𝗧𝗜𝗢𝗡 : আবার লগইন করুন
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  loginError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🔑 𝗟𝗢𝗚𝗜𝗡 𝗙𝗔𝗜𝗟𝗘𝗗
» 🔰 লগইন ব্যর্থ হয়েছে
» 👤 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 : ${d.account || "Facebook"}
» 🆔 𝗨𝗜𝗗 : ${d.uid || "N/A"}
» ⚠️ 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "লগইন করা যায়নি"}
» 🔴 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 | ব্যর্থ
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  cookieError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🍪 𝗖𝗢𝗢𝗞𝗜𝗘 / 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗥𝗥𝗢𝗥
» 🪯 কুকি সমস্যা
» 👤 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 : ${d.account || "Facebook"}
» 🆔 𝗨𝗜𝗗 : ${d.uid || "N/A"}
» 🧩 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "সেশন সঠিক নয়"}
» 🔒 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗜𝗡𝗩𝗔𝗟𝗜𝗗 | সেশন অকার্যকর
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  listenerError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🎧 𝗟𝗜𝗦𝗧𝗘𝗡𝗘𝗥 𝗘𝗥𝗥𝗢𝗥
» 🫷 লিসেনারে সমস্যা
» 📡 𝗘𝗩𝗘𝗡𝗧 : ${d.event || "Messenger Listener"}
» 🧯 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "ইভেন্ট গ্রহণে সমস্যা"}
» 🚨 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗘𝗥𝗥𝗢𝗥 𝗗𝗘𝗧𝗘𝗖𝗧𝗘𝗗
» ⚛️ সমস্যা শনাক্ত
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  spam: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🛑 𝗚𝗥𝗢𝗨𝗣 𝗦𝗣𝗔𝗠 𝗔𝗟𝗘𝗥𝗧
» 🤐 গ্রুপে স্প্যাম
» 👥 𝗚𝗥𝗢𝗨𝗣 : ${d.group || "Unknown"}
» 🆔 𝗚𝗥𝗢𝗨𝗣 𝗜𝗗 : ${d.groupID || "N/A"}
» 🙍 𝗨𝗦𝗘𝗥 : ${d.user || "Unknown"}
» 📛 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 : ${d.details || "অতিরিক্ত মেসেজ শনাক্ত হয়েছে"}
» ⏳ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  commandError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🧾 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗘𝗥𝗥𝗢𝗥
» 😛 কমান্ডে সমস্যা
» ⌨️ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 : ${d.command || "Unknown"}
» 👤 𝗨𝗦𝗘𝗥 𝗜𝗗 : ${d.uid || "N/A"}
» 👥 𝗚𝗥𝗢𝗨𝗣 𝗜𝗗 : ${d.groupID || "N/A"}
» 🐞 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "কমান্ড কাজ করেনি"}
» ❌ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 | ব্যর্থ
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  eventError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🎯 𝗘𝗩𝗘𝗡𝗧 𝗘𝗥𝗥𝗢𝗥
» 😆 ইভেন্টে সমস্যা
» 🧭 𝗘𝗩𝗘𝗡𝗧 : ${d.event || "Unknown"}
» 🐛 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "ইভেন্ট পরিচালনা করা যায়নি"}
» ⚠️ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 | ব্যর্থ
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  databaseError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🗄️ 𝗗𝗔𝗧𝗔𝗕𝗔𝗦𝗘 𝗘𝗥𝗥𝗢𝗥
» 😏 ডেটাবেজ সমস্যা
» 📂 𝗦𝗢𝗨𝗥𝗖𝗘 : ${d.source || "Database"}
» 🐞 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "ডেটা সংরক্ষণে সমস্যা"}
» 🔴 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 | ব্যর্থ
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  systemError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🚨 𝗦𝗬𝗦𝗧𝗘𝗠 𝗘𝗥𝗥𝗢𝗥
» 🤭 সিস্টেম সমস্যা
» 🖥️ 𝗦𝗢𝗨𝗥𝗖𝗘 : ${d.source || "System"}
» 🧨 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "অজানা সিস্টেম সমস্যা"}
» 🔴 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗖𝗥𝗜𝗧𝗜𝗖𝗔𝗟 | গুরুতর
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  guardianError: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡 𝗘𝗥𝗥𝗢𝗥 |
» 😃 গার্ডিয়ান সমস্যা
» ⚙️ 𝗣𝗥𝗢𝗖𝗘𝗦𝗦 : ${d.process || "Guardian"}
» 🧯 𝗘𝗥𝗥𝗢𝗥 : ${d.error || d.details || "Guardian কাজ করছে না"}
» 🔴 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 | ব্যর্থ
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  shutdown: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🌙 𝗕𝗢𝗧 𝗦𝗧𝗢𝗣𝗣𝗘𝗗 |
» ♻️ বট বন্ধ হয়েছে
» 📴 𝗥𝗘𝗔𝗦𝗢𝗡 : ${d.reason || "প্রসেস বন্ধ হয়েছে"}
» 🔌 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗙𝗙𝗟𝗜𝗡𝗘 | বন্ধ
» 📌 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 : ${d.details || "বট বর্তমানে চালু নেই"}
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,

  recovered: (d = {}) => `
» 👑 𝐒𝐈𝐘𝐀𝐌-𝐇𝐀𝐒𝐀𝐍 👑
━━━━━━━━━━━━━━━━
» 🩹 𝗣𝗥𝗢𝗕𝗟𝗘𝗠 𝗙𝗜𝗫𝗘𝗗
» 😔 সমস্যা সমাধান হয়েছে
» 🔧 𝗣𝗥𝗢𝗕𝗟𝗘𝗠 : ${d.problem || "Unknown"}
» 🟢 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗥𝗘𝗖𝗢𝗩𝗘𝗥𝗘𝗗
» 🪯 স্বাভাবিক হয়েছে
» ✨ 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 : ${d.details || "সিস্টেম আবার স্বাভাবিক"}
━━━━━━━━━━━━━━━━
» 🧚‍♀️𝗡𝗜𝗝𝗛𝗨𝗠 𝗖𝗛𝗔𝗧𝗕𝗢𝗧`,
};

function readConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../config.json"), "utf8")
    );
  } catch {
    return {};
  }
}

// Token পাওয়া গেলে তবেই TelegramAPI তৈরি হবে।
function getTelegramClient(config) {
  const tg = config.telegram || {};
  const token = tg.botToken || process.env.TELEGRAM_BOT_TOKEN;

  if (!token) return null;

  if (!telegram || telegramToken !== token) {
    telegram = new TelegramAPI(token);
    telegramToken = token;
  }

  return telegram;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { activeProblems: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const temp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, STATE_PATH);
}

function getRecipients(config) {
  const tg = config.telegram || {};

  return [
    ...new Set(
      [
        ...(Array.isArray(tg.adminUID) ? tg.adminUID : [tg.adminUID]),
        ...(Array.isArray(tg.ownerUID) ? tg.ownerUID : [tg.ownerUID]),
        ...(tg.groupIDs || [])
      ]
        .filter(Boolean)
        .map(String)
    )
  ];
}

async function sendTelegramAlert(type, details = {}, options = {}) {
  const config = readConfig();
  const tg = config.telegram || {};
  const notifications = tg.notifications || {};

  if (tg.enable === false || notifications.enable === false) return false;
  if (notifications[type] === false) return false;

  const design = ALERT_DESIGNS[type];
  if (!design) return false;

  // Token না থাকলে পুরো বট বন্ধ হবে না; শুধু notification বাদ যাবে।
  const client = getTelegramClient(config);
  if (!client) {
    console.warn("[Telegram Notifier] Bot token পাওয়া যায়নি।");
    return false;
  }

  const recipients = getRecipients(config);
  if (!recipients.length) return false;

  const problemKey = String(options.problemKey || type);
  const state = readState();
  state.activeProblems ||= {};

  if (type === "recovered") {
    const recoveredKey = String(options.recoveredKey || problemKey);

    if (!state.activeProblems[recoveredKey]) return false;

    delete state.activeProblems[recoveredKey];
    saveState(state);
  } else {
    // একই সমস্যা চলতে থাকলে আরেকবার নোটিফিকেশন পাঠাবে না।
    if (state.activeProblems[problemKey]) return false;

    state.activeProblems[problemKey] = {
      type,
      time: Date.now()
    };

    saveState(state);
  }

  const message = design(details);

  const results = await Promise.allSettled(
    recipients.map((chatId) => client.sendMessage(chatId, message))
  );

  return results.every((result) => result.status === "fulfilled");
}

module.exports = {
  sendTelegramAlert,
  ALERT_DESIGNS
};
