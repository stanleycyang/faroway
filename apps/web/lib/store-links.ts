export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL;
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
export const HAS_MOBILE_STORE_LINKS = Boolean(APP_STORE_URL || PLAY_STORE_URL);
