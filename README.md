# MATH RIVALS 3D

**Multiplayer 3D First-Person Math Arena Shooter** สำหรับการแข่งขันทบทวนวิชา **คณิตศาสตร์พื้นฐาน 2 (ค31102) ชั้น ม.4 เทอม 2 — บทที่ 1: หลักการนับเบื้องต้น**

ตอบโจทย์คณิตศาสตร์ให้ไวเพื่อสุ่มปลดล็อกอาวุธไซไฟ 4 ชนิด แล้วต่อสู้ในสนามนีออน 3D แบบทีม **Blue vs Red** ร่วมกับเพื่อนแบบ Real-time (2–8 Players) ภายในเวลาแข่งขัน **90 วินาที (01:30)**

---

## Core Features

- **Real 3D Futuristic Neon Arena (Three.js + React Three Fiber)**: สนามต่อสู้แบบสมมาตร Blue vs Red พร้อมพื้น Tron Neon Grid, Energy-Glass Cover, Multi-Level Math Core Platform, 4 Jump Pads และมุมกล้อง First-Person Shooter พร้อม Weapon Viewmodels 3D และ Neon Laser Tracers
- **48 Verified Grade 10 Term 2 Questions**: คลังโจทย์คณิตศาสตร์ ม.4 เทอม 2 (บทที่ 1 หลักการนับเบื้องต้น) ที่คัดกรองและตรวจสอบคำตอบทางคณิตศาสตร์ครบทั้ง 48 ข้อ แบ่ง 3 ระดับ (**Easy 14 / Medium 20 / Hard 14**) พร้อมสูตรใบ้และคำอธิบายวิธีทำภาษาไทยทุกข้อ
  - หลักการคูณและหลักการบวก / การสร้างจำนวนจากตัวเลข
  - แฟกทอเรียลและการแก้สมการแฟกทอเรียล
  - วิธีเรียงสับเปลี่ยนเชิงเส้น ($n!$, $P_{n,r}$, เงื่อนไขยืนติดกัน, ของซ้ำบางส่วน และสูตรที่ 5)
  - การจัดหมู่ ($C_{n,r}$, ผลรวมสัมประสิทธิ์ทวินาม $2^n$, สมการการจัดหมู่ และโจทย์ปัญหาการจัดหมู่)
- **8 Diverse Random Sci-Fi Weapons**:
  | Weapon | Role | Damage / Headshot | Fire Rate | Mag | Reload | Special |
  | --- | --- | --- | --- | --- | --- | --- |
  | **Pulse Pistol** | Precision Sidearm | 28 / 54 | 240 ms | 12 | 1.05s | รีโหลดไวสุด คล่องตัวสูง |
  | **Sheriff-X Magnum** | Heavy Hand Cannon | 55 / 110 | 470 ms | 6 | 1.55s | ลูกโม่แรงสูง นัดเดียวเข้าหัวดับ |
  | **Spectre-9 SMG** | Run & Gun SMG | 15 / 28 | 78 ms | 36 | 1.45s | ยิงรัวสุดขีด 36 นัดสายบุก |
  | **Vector AR-42** | Full-Auto Rifle | 22 / 44 | 115 ms | 28 | 1.65s | ไรเฟิลจู่โจมสมดุลทุกระยะ |
  | **Bulldog-3X Pulse** | 3-Round Burst | 20×3 / 35×3 | 390 ms | 24 | 1.75s | ยิงชุด 3 นัดซ้อนแม่นยำ |
  | **Nova-8 Scatter** | Plasma Shotgun | 18×6 / 28×6 | 740 ms | 6 | 1.95s | กระสุนพลาสมา 6 นัดระยะประชิด |
  | **Odin-V Gatling** | Heavy Plasma LMG | 18 / 32 | 92 ms | 55 | 2.40s | ปืนกลหนัก 55 นัดกราดยิงกดดัน |
  | **Hyperion Rail** | Railgun Sniper | 85 / 140 | 1,120 ms | 5 | 2.15s | ยิงหัว 1 นัดดับ + คลิกขวาซูมสโคป |
- **4 Valorant-Style Tactical Agents & 12 Server-Authoritative Skills (`[Q]` `[C]` `[X]`)**:
  - ตอบคณิตถูก **+1 แต้มอัลติ** และ Kill **+1 แต้มอัลติ** (สะสมครบ **4 แต้ม** กด `[X]` ใช้อัลติ!)
  | Agent | Role | `[Q]` Tactical Skill | `[C]` Utility Skill | `[X]` Ultimate (4 pts) |
  | --- | --- | --- | --- | --- |
  | **VORTEX** | Duelist | **Tailwind Dash** (พุ่งตัวความเร็วสูง) | **Flashpulse Orb** (แฟลชศัตรูตาพร่า 2.2 วิ) | **Overdrive Surge** (วิ่งไว+ยิงเร็ว 35%+ดาเมจ 25%) |
  | **AEGIS** | Sentinel | **Nano Heal** (+45 HP ทันที) | **Barrier Wall** (กำแพง 3D กันกระสุนจริง 12 วิ) | **Titan Shield** (เกราะ 175 HP นาน 10 วิ) |
  | **PHANTOM** | Controller | **Shadow Smoke** (โดมควัน 3D บังสายตา 10 วิ) | **Phase Blink** (วาร์ปทะลุมิติ 10 เมตร) | **Orbital Strike** (ลำแสงไอออนจากฟ้า 90 AOE) |
  | **PULSE** | Initiator | **Recon Sonar** (สแกนเห็นศัตรูทะลุกำแพง 5.5 วิ) | **Shock Cluster** (ระเบิดพลาสมา 55 AOE) | **Hyper Barrage** (จรวดพลาสมา 120 AOE) |
- **Scoring & Anti-Cheat (Server-Authoritative)**:
  - ตอบถูก: **+100 คะแนน** + สุ่มอาวุธจาก 8 กระบอก + **+1 Ultimate Charge**
  - ตอบผิด: **+0 คะแนน** (ไม่ได้รับอาวุธ พร้อมแสดงวิธีทำ)
  - Elimination (Kill): **+150 คะแนน** + **+1 Ultimate Charge**
  - Headshot Bonus: **+50 คะแนน** (รวม **+200 คะแนน** เมื่อยิงหัวดับ)
  - ป้องกันการตอบคำถามเดิมซ้ำเพื่อฟาร์มคะแนน (Server-tracked `attemptedQuestionIds` และ DB `UNIQUE` constraint)
  - ตรวจสอบ Hit Detection, กำแพงสกิลกันกระสุน, Skill Cooldown, Ultimate Charge, Fire Rate และ Session Token ฝั่งเซิร์ฟเวอร์ทั้งหมด
- **Real-time Multiplayer (2–8 Players)**:
  - Create Room / Join Room ผ่าน **Room Code 6 หลัก**
  - Lobby แยกทีม Blue vs Red พร้อม **Agent Selector**, Switch Team, Ready Status และ Host Start
  - Synchronized 3-2-1 Countdown และ 90-second Real-time Timer
  - รองรับ Auto-Reconnect (คืนค่าคะแนนและอาวุธเดิมเมื่อรีเฟรชหน้า) และการจัดการ Disconnect อย่างปลอดภัย
  - รองรับ 2 โหมด Backend: **Authoritative WebSocket Server (`server/index.ts`)** และ **Supabase Realtime + PostgreSQL RPCs (`supabase/schema.sql`)**

---

## Controls (Desktop)

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | เดินเคลื่อนที่ |
| `Shift` | วิ่งเร็ว (Sprint) |
| `Space` | กระโดด (Jump / Jump Pads) |
| `Mouse` | เล็งเป้าหมาย (คลิกที่สนามเพื่อล็อกเมาส์) |
| `Left Click` (หรือ `F`) | ยิงอาวุธ (กดค้างสำหรับปืน Full-Auto: SMG / Rifle / LMG) |
| `Right Click` | ซูมเล็ง (ADS / Sniper Scope) |
| `R` | รีโหลดกระสุน |
| `Q` / `C` | ใช้สกิล Tactical / Utility ของ Agent |
| `X` | ใช้สกิล **Ultimate** (เมื่อสะสมครบ 4 แต้มจากคณิต/Kill) |
| `E` | เปิด/ปิดหน้าต่างตอบโจทย์คณิตศาสตร์ (กดปุ่ม `1`–`4` ตอบด่วนได้ทันที) |
| `Tab` (กดค้าง) | ดู Live Scoreboard เต็มจอ |
| `ESC` | เปิดเมนู Pause / ปรับ Mouse Sensitivity / เปิด-ปิดเสียง |

---

## Project Structure

```text
.
├── server/
│   ├── index.ts                # Node.js HTTP + WebSocket authoritative game server (20Hz tick)
│   └── roomManager.ts          # Room lifecycle, 90s timer, quiz validator, 3D raycast hit detection
├── shared/
│   ├── arena.ts                # Shared 3D arena geometry, spawns, collision & ray-hitbox math
│   ├── questions.ts            # 48 verified Grade 10 Term 2 combinatorics questions
│   ├── types.ts                # Shared domain types, scoring constants, WS protocol
│   └── weapons.ts              # 4 sci-fi weapon specifications & difficulty-weighted randomizer
├── src/
│   ├── components/             # 8+ Esports UI screens (Menu, Room, Lobby, HUD, MathModal, Reveal, Scoreboard, Pause, Result)
│   ├── game/                   # Three.js / R3F 3D Arena, FPS PlayerController, 4 Viewmodels, Avatars, Tracers, Web Audio SFX
│   ├── multiplayer/            # Unified client facade (WebSocket adapter + Supabase Realtime adapter)
│   └── store/                  # Zustand state store + 60fps transform cache + session reconnect
├── supabase/
│   └── schema.sql              # PostgreSQL tables, RLS policies, and SECURITY DEFINER RPCs
├── tests/
│   ├── questions.test.ts       # Math bank integrity & sanitization tests
│   ├── roomManager.test.ts     # Functional, timer, combat, reconnect & security tests
│   └── multiplayer.e2e.py      # Real 2-browser Playwright E2E multiplayer verification suite
├── .env.example
├── render.yaml                 # One-click Render Blueprint for WebSocket server
└── vercel.json                 # Vercel SPA configuration for Frontend
```

---

## วิธี Run Local

### ข้อกำหนดเบื้องต้น
- Node.js `>= 20` (ทดสอบบน Node v22)
- npm `>= 10`

### ขั้นตอนการรัน
```bash
# 1. Clone repository
git clone https://github.com/KhunSiwa/-rival.git
cd -rival

# 2. ติดตั้ง dependencies
npm install

# 3. คัดลอกไฟล์ตั้งค่า environment (ค่าเริ่มต้นใช้โหมด ws ซึ่งรันได้ทันทีโดยไม่ต้องใส่ key)
cp .env.example .env

# 4. รันทั้ง Frontend (port 5173) และ Authoritative Game Server (port 3001) พร้อมกัน
npm run dev:full
```

จากนั้นเปิดเบราว์เซอร์ 2 แท็บ (หรือ 2 เครื่องในวง LAN) ไปที่ `http://localhost:5173`:
- แท็บที่ 1: ใส่ชื่อ -> กด **CREATE ROOM** -> คัดลอก Room Code 6 หลัก
- แท็บที่ 2: ใส่ชื่อ -> กด **JOIN ROOM** -> ใส่ Room Code -> กด **MARK READY**
- แท็บที่ 1 (Host): กด **START MATCH (90s)** เพื่อเริ่มแข่ง!

---

## วิธีตั้งค่า Supabase (Optional — สำหรับโหมด Supabase Realtime)

หากต้องการรันผ่าน **Supabase Realtime + PostgreSQL RPC** แทนการโฮสต์ WebSocket Server แยก:

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. เปิดเมนู **SQL Editor** -> คัดลอกโค้ดทั้งหมดจากไฟล์ [`supabase/schema.sql`](supabase/schema.sql) แล้วกด **Run**
   - สคริปต์นี้จะสร้างตาราง `rooms`, `room_players`, `question_attempts` (มี `UNIQUE(room_id, player_id, question_id)` ป้องกันตอบซ้ำระดับฐานข้อมูล), `combat_events`, Row Level Security (RLS), Safe Public View (ซ่อน `session_token`) และ Authoritative `SECURITY DEFINER` RPCs
3. ไปที่ **Project Settings → API** แล้วคัดลอก **Project URL** และ **anon public key** (ห้ามใช้ `service_role` key บน Frontend เด็ดขาด!)
4. ตั้งค่าใน `.env` (หรือ Vercel Environment Variables):
   ```env
   VITE_MULTIPLAYER_MODE=supabase
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

---

## วิธี Deploy ขึ้นอินเทอร์เน็ตเพื่อให้เพื่อนเล่นด้วยกันได้จริง

### แนวทางที่แนะนำ (ความแม่นยำสูงสุด): Vercel (Frontend) + Render (Authoritative WS Server)

1. **Deploy Game Server บน Render (ฟรี)**
   - ไปที่ [render.com](https://render.com) → **New → Blueprint** → เชื่อมต่อ Repository `KhunSiwa/-rival`
   - Render จะอ่านไฟล์ [`render.yaml`](render.yaml) และสร้าง Web Service ให้อัตโนมัติ (ตรวจสอบได้ผ่าน `GET /health`)
   - คัดลอก URL ของเซิร์ฟเวอร์ เช่น `https://math-rivals-3d-server.onrender.com`
2. **Deploy Frontend บน Vercel (ฟรี)**
   - ไปที่ [vercel.com](https://vercel.com) → **Add New Project** → Import `KhunSiwa/-rival`
   - ตั้งค่า Environment Variables:
     - `VITE_MULTIPLAYER_MODE` = `ws`
     - `VITE_WS_URL` = `wss://math-rivals-3d-server.onrender.com/ws`
   - กด **Deploy** แล้วแชร์ลิงก์ Vercel ให้เพื่อนเข้าเล่นพร้อมกันได้ทันที!

### แนวทางทางเลือก: Vercel (Frontend) + Supabase (Backend)
- ทำตามขั้นตอน **วิธีตั้งค่า Supabase** ด้านบน แล้ว Import โปรเจกต์ขึ้น Vercel พร้อมตั้งค่า `VITE_MULTIPLAYER_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Verification & Testing

```bash
# TypeScript strict check (client + shared + server + tests)
npm run typecheck

# ESLint check
npm run lint

# Unit & Security tests (48 questions + RoomManager anti-cheat, hit detection, timer, reconnect)
npm test

# Production build check
npm run build

# Real 2-browser Playwright E2E test (requires `npm run dev:full` running)
python3 tests/multiplayer.e2e.py
```
