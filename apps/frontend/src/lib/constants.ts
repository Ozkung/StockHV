export type Role = 'ADMIN' | 'STOCK_MANAGER' | 'STAFF';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  STOCK_MANAGER: 'ผู้จัดการคลัง',
  STAFF: 'เจ้าหน้าที่',
};

export const ROLE_COLOR: Record<Role, string> = {
  ADMIN: 'magenta',
  STOCK_MANAGER: 'blue',
  STAFF: 'default',
};

export const isManager = (role?: string) => role === 'ADMIN' || role === 'STOCK_MANAGER';

export const CATEGORY_LABEL: Record<string, string> = { DRUG: 'ยา', SUPPLY: 'เวชภัณฑ์' };

export const UNITS = ['เม็ด', 'แคปซูล', 'ขวด', 'ซอง', 'ชิ้น', 'กล่อง', 'ถุง', 'หลอด', 'อัน', 'แผง', 'ม้วน'];

export const TX_TYPE: Record<string, { label: string; color: string }> = {
  IN_PURCHASE: { label: 'ซื้อเข้า', color: 'green' },
  IN_DONATION: { label: 'บริจาค', color: 'cyan' },
  OUT_PRESCRIPTION: { label: 'จ่ายยา', color: 'blue' },
  OUT_SUPPLY: { label: 'เบิกใช้', color: 'geekblue' },
  ADJ_APPROVED: { label: 'ปรับยอด', color: 'orange' },
  OUT_EXPIRED: { label: 'หมดอายุ', color: 'red' },
};

export const formatDate = (v: string | Date, withTime = false) =>
  new Date(v).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
