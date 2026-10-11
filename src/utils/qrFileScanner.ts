import jsQR from 'jsqr';

export const processQrImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));
                
                ctx.drawImage(img, 0, 0, img.width, img.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "attemptBoth",
                });
                
                if (code && code.data) {
                    resolve(code.data);
                } else {
                    reject(new Error('No QR or Barcode found in the image. Please try again with a clearer photo.'));
                }
            };
            img.onerror = () => reject(new Error('Failed to load image.'));
            if (e.target?.result) {
                img.src = e.target.result as string;
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    });
};
