export const encodeShapesToDataImage = (shapes) => {
  const text = JSON.stringify(shapes);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(text);
  
  const totalBytesNeeded = dataBytes.length + 1; // +1 for Null Terminator (0)
  const totalPixelsNeeded = Math.ceil(totalBytesNeeded / 3);
  const size = Math.ceil(Math.sqrt(totalPixelsNeeded)) || 1;
  
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  
  let byteIndex = 0;
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i]     = byteIndex < dataBytes.length ? dataBytes[byteIndex++] : 0;
    imgData.data[i + 1] = byteIndex < dataBytes.length ? dataBytes[byteIndex++] : 0;
    imgData.data[i + 2] = byteIndex < dataBytes.length ? dataBytes[byteIndex++] : 0;
    imgData.data[i + 3] = 255; // Alpha MUST be 255 to prevent browser pixel premultiplication
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1]; // Return just the base64 payload
};

export const decodeDataImageToShapes = (imgElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.width;
  canvas.height = imgElement.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgElement, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const decodedBytes = [];
  for (let i = 0; i < imgData.data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      const byte = imgData.data[i + j];
      if (byte === 0) { // Null terminator reached
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(new Uint8Array(decodedBytes));
        return JSON.parse(jsonString);
      }
      decodedBytes.push(byte);
    }
  }
  throw new Error("No null terminator found. Invalid data image.");
};