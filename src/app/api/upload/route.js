import { NextResponse } from 'next/server';
import { uploadWithKeyRotation } from '@/lib/imgbbUploader'; 

export async function POST(req) {
  try {
    const body = await req.json();

    // 👉 SCENARIO A: Dual-Upload (Original + Thumbnail)
    if ((body.thumbnailBase64 || body.thumbTempUrl) && body.tempUrl) {
      const thumbSource = body.thumbTempUrl ? body.thumbTempUrl : body.thumbnailBase64;

      const [thumbData, fullData] = await Promise.all([
        uploadWithKeyRotation(thumbSource),
        uploadWithKeyRotation(body.tempUrl)
      ]);

      return NextResponse.json({ 
        thumbnailUrl: thumbData.url,
        imageUrl: fullData.url
      });
    }

    // 👉 SCENARIO B: Encoded Critique Layer (Now 100% URL-based!)
    if (body.encodedTempUrl || body.imageBase64) {
      
      // Accept either the new Temp URL or a legacy Base64 string
      const uploadSource = body.encodedTempUrl ? body.encodedTempUrl : body.imageBase64;
      const data = await uploadWithKeyRotation(uploadSource);
      
      return NextResponse.json({ url: data.url });
    }

    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  } catch (error) {
    console.error("Vercel Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}