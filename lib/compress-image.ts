/**
 * Client-side image compression utility.
 * Scales to a max dimension, then iterates JPEG quality until
 * the blob is under maxBytes. Safe to import in any "use client" component.
 */
export async function compressImage(
  file: File | Blob,
  maxBytes = 500 * 1024, // 500 KB default
  maxDimension = 1920
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const attempt = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            if (blob.size <= maxBytes || quality <= 0.2) {
              resolve(blob);
            } else {
              quality = Math.round((quality - 0.1) * 10) / 10;
              attempt();
            }
          },
          "image/jpeg",
          quality
        );
      };
      attempt();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };

    img.src = objectUrl;
  });
}
