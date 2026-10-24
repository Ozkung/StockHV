# StockHV

ระบบบริหารคลังยาและเวชภัณฑ์ — แยกออกมาจากโมดูล Inventory ของ HomeMed Connect (`poc_homeless`) เป็นแอปอิสระ
มีฐานข้อมูล ผู้ใช้ และการ login ของตัวเอง ไม่ต้องพึ่ง poc_homeless

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + NextAuth (credentials) + Ant Design 6 |
| Backend | NestJS 10 + Prisma 6 |
| Database | PostgreSQL 16 |
| Infra | Docker Compose |

```
apps/
  backend/   — NestJS API (port 3001)
  frontend/  — Next.js UI (port 3000); proxies /backend/* → API
```

## Quick start

```bash
cp .env.example .env            # แก้ JWT_SECRET / NEXTAUTH_SECRET
docker compose up postgres -d
npm install
cd apps/backend && npx prisma migrate dev && npm run db:seed && cd ../..
npm run dev
```

เปิด http://localhost:3000 — seed สร้างผู้ใช้ `admin@`, `manager@`, `staff@stockhv.local` รหัส `password123`
ถ้าไม่ใช้ seed ให้ไปที่ `/setup` เพื่อสร้างหน่วยงานและผู้ดูแลระบบคนแรก

ทั้งระบบด้วย Docker: `docker compose up --build`

## สิทธิ์ผู้ใช้

| Role | ทำอะไรได้ |
|------|-----------|
| `ADMIN` | ทุกอย่าง + จัดการผู้ใช้ + Audit log; ปรับยอดได้ทันทีไม่ต้องรออนุมัติ |
| `STOCK_MANAGER` | เพิ่ม/แก้รายการ, รับเข้า, ปรับยอด, อนุมัติคำขอของคนอื่น, นำ lot หมดอายุออก |
| `STAFF` | ดูคลัง/ประวัติ, จ่ายยา/เบิกใช้ |

## ฟีเจอร์

- รายการยา (DRUG) / เวชภัณฑ์ (SUPPLY) พร้อมเกณฑ์แจ้งเตือนสต็อกต่ำ
- รับเข้าแบบ lot (ซื้อ/บริจาค) พร้อมวันหมดอายุ ใบเสร็จ ราคาต่อหน่วย
- จ่าย/เบิก ตัดจาก lot ที่หมดอายุก่อน (FIFO by expiry) พร้อมช่องอ้างอิง (HN ผู้ป่วย, งาน, แผนก)
- ปรับยอด (ADJ): |จำนวน| ≤ `ADJ_AUTO_APPROVE_LIMIT` (ค่าเริ่ม 20) มีผลทันที, มากกว่านั้นต้องให้คนอื่นอนุมัติ
- แจ้ง lot ใกล้หมดอายุ (`EXPIRY_WARNING_DAYS`, ค่าเริ่ม 30 วัน) และนำออกจากสต็อก
- Dashboard, ประวัติความเคลื่อนไหว, Export CSV, Audit log

## ต่างจากโมดูลเดิมใน poc_homeless

- ตัดส่วนที่ผูกกับระบบผู้ป่วยออก: `patientId`/`eventId` → ช่องข้อความ `reference`; ไม่สร้าง `Activity` DISPENSE
- ไม่มีแจ้งเตือน LINE / Redis / Bull — สต็อกต่ำและ lot ใกล้หมดอายุแสดงบน Dashboard แทน
- Role ใหม่: `SUPER_ADMIN`→`ADMIN`, `STOCK_MANAGER` คงเดิม, `CASE_MANAGER`/`DOCTOR`→`STAFF`
- JWT อายุเดียว (`JWT_EXPIRES_IN`, ค่าเริ่ม 12h) ไม่มี refresh token
- แก้ race condition: การตัด/เพิ่มสต็อกเป็น atomic ใน transaction (ยิงพร้อมกันไม่ทำให้ติดลบ),
  การปรับยอดลดจะตัด lot ด้วยเพื่อให้ยอด lot ตรงกับยอดคงเหลือ, อนุมัติคำขอซ้ำพร้อมกันไม่ได้
- เพิ่ม: แก้ไขหน่วย/หมวด/เกณฑ์, เก็บรายการ (archive), ดู lot ต่อรายการ, จัดการผู้ใช้, ประวัติคำขอ ADJ

## Tests

```bash
npm test -w @stockhv/backend
```
