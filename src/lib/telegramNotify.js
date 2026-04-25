// src/lib/telegramNotify.js

export async function sendTelegramDM(telegramId, message, deepLinkUrl = null) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_TOKEN) return;

  // 👉 Dynamically construct the bot link using your .env variables!
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'CaptionGiverbot';
  const appShortName = process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME || 'AFC';
  const APP_DEEP_LINK = `https://t.me/${botUsername}/${appShortName}`;
  
  const payload = {
    chat_id: telegramId,
    text: message,
    parse_mode: 'HTML' // Allows us to use <b>bold</b> and <i>italics</i>
  };

  if (deepLinkUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "📱 Open Critique Engine", url: `${APP_DEEP_LINK}?startapp=${deepLinkUrl}` }]]
    };
  }

  try {
    // 🔥 FIRE AND FORGET
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error("Telegram DM Failed:", err));
    
  } catch (error) {
    console.error("Telegram Notify Error:", error);
  }
}