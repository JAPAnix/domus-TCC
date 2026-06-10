const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg, err) => {
    if (isDev) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err);
    } else {
      console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
    }
  }
};