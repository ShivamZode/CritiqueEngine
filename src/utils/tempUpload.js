/**
 * src/utils/tempUpload.js
 * * The Waterfall Uploader: Tries multiple temporary file hosts in sequence.
 * If one is down or rate-limiting, it instantly cascades to the next one.
 * This guarantees zero memory usage on your Vercel server and high reliability.
 */

export const uploadToTempService = async (file) => {
  // Array of upload strategies. It tries them in order from top to bottom.
  const providers = [
    // 🌊 Primary: Litterbox 
    // Pros: Super fast, gives direct image links.
    // Cons: Strict 5 req / 2 sec limit.
    async (f) => {
      const fd = new FormData();
      fd.append('reqtype', 'fileupload');
      fd.append('time', '1h'); // 1 hour retention is plenty for our backend to grab it
      fd.append('fileToUpload', f);
      
      const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { 
        method: 'POST', 
        body: fd 
      });
      
      if (!res.ok) throw new Error('Litterbox API failed or rate-limited');
      
      const textUrl = await res.text();
      // Litterbox returns the raw text URL, but let's make sure it's valid
      if (!textUrl.startsWith('http')) throw new Error('Litterbox returned invalid URL');
      return textUrl; 
    },

    // 🌊 Fallback 1: File.io 
    // Pros: Very reliable, good API.
    // Cons: Single-download links (but our backend downloads it immediately, so this is fine!)
    async (f) => {
      const fd = new FormData();
      fd.append('file', f);
      
      const res = await fetch('https://file.io/', { 
        method: 'POST', 
        body: fd 
      });
      
      if (!res.ok) throw new Error('File.io API failed');
      
      const data = await res.json();
      if (!data.success) throw new Error('File.io returned unsuccessful response');
      return data.link; 
    }

    // You can easily add more fallbacks here in the future (e.g., tmpfiles.org when they fix their servers)
  ];

  // The Waterfall Execution Loop
  for (let i = 0; i < providers.length; i++) {
    try {
      // Attempt the upload with the current provider
      const url = await providers[i](file);
      return url; // If it works, instantly return the URL and exit the loop!
    } catch (error) {
      console.warn(`Temp upload provider ${i + 1} failed, cascading to next...`, error.message);
      // If it fails, the loop just continues to the next provider silently.
    }
  }
  
  // If the loop finishes and all providers failed:
  throw new Error("All temporary file upload providers failed. Please check your network connection.");
};