const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;
export const ADMIN_EMAILS: string[] = adminEmail ? [adminEmail] : [];
