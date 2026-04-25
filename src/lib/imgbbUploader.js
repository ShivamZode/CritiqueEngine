export async function uploadWithKeyRotation(imagePayload) {
  const keysString = process.env.IMGBB_API_KEYS;
  if (!keysString) throw new Error("No ImgBB keys configured in .env.local");

  let availableKeys = keysString.split(',');

  while (availableKeys.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    const activeKey = availableKeys[randomIndex];
    
    try {
      const formData = new FormData();
      formData.append('image', imagePayload);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();

      if (data.success) {
        return data.data; 
      } else {
        const errMsg = data.error?.message || "ImgBB returned an error.";
        const lowerErr = errMsg.toLowerCase();
        
        // 🛡️ THE POISON PILL SHIELD 🛡️
        // If ImgBB rejects the actual file data, do not blame the API key!
        if (
          lowerErr.includes('invalid') || 
          lowerErr.includes('empty') || 
          lowerErr.includes('format') || 
          lowerErr.includes('support')
        ) {
           const fatalError = new Error(`Image rejected: ${errMsg}`);
           fatalError.isPoisonPill = true; // Tag it so the catch block knows!
           throw fatalError;
        }
        // If it wasn't a bad file, assume it's a bad key/rate limit
        throw new Error(errMsg);
      }
      
    } catch (error) {
      // 🛡️ THE FAST-FAIL ABORT 🛡️
      if (error.isPoisonPill) {
        console.error(`🛑 FATAL: Bad file detected. Aborting key rotation to save traffic.`);
        throw error; // Instantly kicks the error back to the route.js, ending the Lambda!
      }

      console.warn(`⚠️ ImgBB Key failed: ${error.message}. Removing key from pool and rotating...`);
      availableKeys.splice(randomIndex, 1);
    }
  }

  throw new Error("CRITICAL: All ImgBB API keys have been exhausted or failed.");
}