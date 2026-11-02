const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

let pendingDownloads = {};

module.exports = {
  config: {
    name: "ytb",
    aliases: ["ytb", "ytb2", "ytb3"],
    version: "7.7",
    author: "Siam Hasan",
    role: 0,
    category: "media",
    shortDescription: "ইউটিউব ভিডিও সার্চ ও ডাউনলোড করুন খুব সহজে",
    longDescription: "ইউটিউব থেকে ভিডিও সার্চ করুন, সেরা ফলাফল দেখুন এবং নাম্বার রিপ্লাই করে ডাউনলোড করুন।",
    guide: {}
  },

  onStart: async function({ api, event, args }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    
    const firstWord = event.body?.trim().split(" ")[0] || "";
    const commandName = firstWord.replace(/^[/!.]/, "").toLowerCase();

    const query = args.join(" ").trim();  
    if (!query) {
      return api.sendMessage("❌ দয়া করে একটি সার্চ কিওয়ার্ড বা নাম লিখুন!", threadID, messageID);  
    }  

    try {
      await api.setMessageReaction("🔎", messageID, () => {}, true);
    } catch (e) {}

    try {  
      const res = await axios.get(`https://aminul-youtube-api.vercel.app/search?query=${encodeURIComponent(query)}`);  
      const data = res.data;  

      if (!data || data.length === 0) {  
        return api.sendMessage("😔 কোনো ভিডিও পাওয়া যায়নি! অন্য কিছু লিখে সার্চ করুন।", threadID, messageID);  
      }  

      const videos = data.slice(0, 5); 
      
      pendingDownloads[threadID] = {
        videos: videos,
        mode: commandName,
        userID: event.senderID
      };  

      let attachments = [];  
      let msg = `🎵 ইউটিউব সার্চ ফলাফল 🎵\n🔍 খোঁজার শব্দ: ${query}\n\n`;  
      msg += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;  

      for (let i = 0; i < videos.length; i++) {  
        const v = videos[i];  
        msg += `🔹 ${i + 1}. ${v.title}\n`;  
        msg += `⏳ সময়: ${v.duration?.timestamp || "প্রযোজ্য নয়"}\n`;  
        msg += `📅 প্রকাশের তারিখ: ${v.publishedAt || "রিয়েল-টাইম"}\n`;  
        msg += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;  

        if (commandName !== "ytb2" && commandName !== "ytb3" && v.thumbnail) {  
          try {  
            const thumbPath = await downloadImage(v.thumbnail, `thumb_${threadID}_${i}.jpg`);  
            if (fs.existsSync(thumbPath)) {
              attachments.push(fs.createReadStream(thumbPath));  
            }
          } catch (thumbErr) {  
            console.error("Thumbnail download error:", thumbErr);  
          }  
        }  
      }  

      msg += `\n📥 ১ থেকে ৫ এর মধ্যে যেকোনো একটি নাম্বার রিপ্লাই করে আপনার পছন্দের ভিডিওটি ডাউনলোড করুন!\n⚡ Author: Siam Hasan`;  

      return api.sendMessage({   
        body: msg,   
        attachment: attachments.length > 0 ? attachments : null   
      }, threadID, (err, info) => {
        if (!err && info) {
          pendingDownloads[threadID].listMessageID = info.messageID;
        }
        setTimeout(() => {
          for (let i = 0; i < 5; i++) {  
            const thumbPath = path.join(__dirname, `thumb_${threadID}_${i}.jpg`);  
            if (fs.existsSync(thumbPath)) {  
              try { fs.unlinkSync(thumbPath); } catch(e) {} 
            }  
          }
        }, 5000);
      });  

    } catch (err) {  
      console.error("Search error:", err);  
      api.sendMessage("⚠️ ইউটিউব থেকে ভিডিও আনতে ব্যর্থ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", threadID, messageID);  
    }
  },

  onChat: async function({ api, event }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const message = event.body?.trim();

    if (!message || !pendingDownloads[threadID] || !/^[1-5]$/.test(message)) return;  

    if (pendingDownloads[threadID].userID && pendingDownloads[threadID].userID !== event.senderID) {
      return;
    }

    const sessionData = pendingDownloads[threadID];
    const index = parseInt(message) - 1;  
    const video = sessionData.videos[index];  
      
    if (!video) {  
      return api.sendMessage("❌ ভুল নির্বাচন করা হয়েছে!", threadID, messageID);  
    }  

    const title = video.title;  
    const url = video.url;  
    const mode = sessionData.mode;

    if (sessionData.listMessageID) {
      try {
        await api.unsendMessage(sessionData.listMessageID);
      } catch (e) {}
    }

    const loadingMsgInfo = await api.sendMessage(`⏳ ডাউনলোড হচ্ছে: ${title}... দয়া করে অপেক্ষা করুন!`, threadID);  
    const loadingMessageID = loadingMsgInfo?.messageID;

    try {  
      const downloadInfo = await axios.get(`https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=${encodeURIComponent(url)}`, { timeout: 25000 });  
        
      const videoData = downloadInfo.data?.data?.data;  
      if (!videoData) {  
        throw new Error("এপিআই রেসপন্স স্ট্রাকচার সঠিক নয়");  
      }  

      let targetUrl = videoData.high || videoData.low;
      if (mode === "ytb3") {
        if (videoData.audio) {
          targetUrl = videoData.audio;
        } else if (downloadInfo.data?.data?.audio) {
          targetUrl = downloadInfo.data.data.audio;
        } else if (downloadInfo.data?.audio) {
          targetUrl = downloadInfo.data.audio;
        }
      }

      if (!targetUrl) {  
        if (loadingMessageID) {
          try { await api.unsendMessage(loadingMessageID); } catch(e) {}
        }
        return api.sendMessage("❌ এই মিডিয়াটির ডাউনলোড লিংক পাওয়া যায়নি। এটি সুরক্ষিত বা রেস্ট্রিক্টেড হতে পারে।", threadID);  
      }  

      const cacheDir = path.join(__dirname, "cache");  
      await fs.ensureDir(cacheDir);  

      const fileExtension = mode === "ytb3" ? "mp3" : "mp4";
      const filePath = path.join(cacheDir, `yt_${threadID}_${Date.now()}.${fileExtension}`);  

      await downloadFile(targetUrl, filePath);  

      if (loadingMessageID) {
        try { await api.unsendMessage(loadingMessageID); } catch(e) {}
      }

      await api.sendMessage({  
        body: `✅ ডাউনলোড সফল হয়েছে!\n\n🎬 শিরোনাম: ${title}\n📥 আপনার ফাইলটি প্রস্তুত!`,  
        attachment: fs.createReadStream(filePath)  
      }, threadID, () => {  
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);  
        }
      });  

    } catch (err) {  
      console.error("Download error:", err);  
      if (loadingMessageID) {
        try { await api.unsendMessage(loadingMessageID); } catch(e) {}
      }
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        api.sendMessage("⏱️ ডাউনলোডের সময় শেষ হয়ে গেছে! সার্ভার থেকে খুব ধীরগতি পাওয়া যাচ্ছে।", threadID);
      } else {
        api.sendMessage(`❌ ত্রুটি: ${err.message || "ডাউনলোড করতে ব্যর্থ হয়েছে।"}`, threadID);
      }
    }  

    delete pendingDownloads[threadID];
  }
};

async function downloadImage(url, filename) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const filePath = path.join(__dirname, filename);  
    await fs.writeFile(filePath, response.data);  
    return filePath;
  } catch (error) {
    throw new Error(`থাম্বনেইল ডাউনলোড করতে ব্যর্থ: ${error.message}`);
  }
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    const request = https.get(url, (response) => {  
      if (response.statusCode === 301 || response.statusCode === 302) {  
        const redirectUrl = response.headers.location;  
        return downloadFile(redirectUrl, filepath).then(resolve).catch(reject);  
      }  

      if (response.statusCode !== 200) {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return reject(new Error(`সার্ভার থেকে কোড এসেছে: ${response.statusCode}`));
      }

      response.pipe(file);  
        
      file.on('finish', () => {  
        file.close();  
        resolve();  
      });  
        
    });

    request.on('error', (err) => {  
      if (fs.existsSync(filepath)) {  
        fs.unlinkSync(filepath);  
      }  
      reject(err);  
    });

    request.setTimeout(40000, () => {
      request.destroy();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error('সর 😁🫷 আবাল সময় শেষ'));
    });
  });
}
