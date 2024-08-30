class ImageLoader {
  constructor() {
    this.images = {};
  }

  load(imageSources) {
    const promises = Object.entries(imageSources).map(([key, src]) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.images[key] = img;
          // console.log(`Image loaded successfully: ${key} (${src})`);
          resolve();
        };
        img.onerror = (error) => {
          // console.error(`Failed to load image: ${key} (${src})`, error);
          reject(error);
        };
        img.src = src;
      });
    });

    return Promise.all(promises);
  }

  getImage(key) {
    return this.images[key];
  }
}

export default ImageLoader;
