import type { AgentId, SkillSlot } from './types.ts'

export interface SkillSpec {
  slot: SkillSlot
  id: string
  name: string
  thaiDesc: string
  cooldownSec: number // 0 for Ultimate (uses ultPoints instead)
  ultCost?: number
  accentColor: string
}

export interface AgentSpec {
  id: AgentId
  name: string
  role: 'DUELIST' | 'SENTINEL' | 'CONTROLLER' | 'INITIATOR'
  roleThai: string
  accentColor: string
  tagline: string
  skills: Record<SkillSlot, SkillSpec>
}

export const ULT_MAX_POINTS = 4

export const AGENTS: Record<AgentId, AgentSpec> = {
  vortex: {
    id: 'vortex',
    name: 'VORTEX',
    role: 'DUELIST',
    roleThai: 'สายบุกความเร็วสูง',
    accentColor: '#00e5ff',
    tagline: 'พุ่งทะลวง ปาแฟลชเปิดทาง และเร่งสปีดยิงรัวด้วย Overdrive',
    skills: {
      Q: {
        slot: 'Q',
        id: 'dash',
        name: 'TAILWIND DASH',
        thaiDesc: 'พุ่งตัวความเร็วสูงไปตามทิศที่เล็งทันที',
        cooldownSec: 7,
        accentColor: '#00e5ff',
      },
      C: {
        slot: 'C',
        id: 'flash',
        name: 'FLASHPULSE ORB',
        thaiDesc: 'ปาลูกบอลแฟลชทำให้ศัตรูในระยะตาพร่า 2.2 วินาที',
        cooldownSec: 11,
        accentColor: '#38bdf8',
      },
      X: {
        slot: 'X',
        id: 'overdrive',
        name: 'OVERDRIVE SURGE',
        thaiDesc: 'อัลติ: วิ่งไวขึ้น + ยิงเร็วขึ้น 35% + ดาเมจแรงขึ้น 25% นาน 8 วิ',
        cooldownSec: 0,
        ultCost: ULT_MAX_POINTS,
        accentColor: '#22d3ee',
      },
    },
  },
  aegis: {
    id: 'aegis',
    name: 'AEGIS',
    role: 'SENTINEL',
    roleThai: 'สายป้องกันและฟื้นฟู',
    accentColor: '#10f59b',
    tagline: 'สร้างกำแพงนีออนกันกระสุนจริง ฮีลตัวเอง และเปิดเกราะ Titan Shield',
    skills: {
      Q: {
        slot: 'Q',
        id: 'heal',
        name: 'NANO HEAL',
        thaiDesc: 'ฟื้นฟูพลังชีวิตทันที +45 HP',
        cooldownSec: 9,
        accentColor: '#10f59b',
      },
      C: {
        slot: 'C',
        id: 'barrier',
        name: 'BARRIER WALL',
        thaiDesc: 'สร้างกำแพงพลังงาน 3D กันกระสุนและทางเดินนาน 12 วิ',
        cooldownSec: 13,
        accentColor: '#34d399',
      },
      X: {
        slot: 'X',
        id: 'overshield',
        name: 'TITAN SHIELD',
        thaiDesc: 'อัลติ: เกราะพลังงาน 175 HP นาน 10 วิ + รีโหลดกระสุนเต็มทันที',
        cooldownSec: 0,
        ultCost: ULT_MAX_POINTS,
        accentColor: '#6ee7b7',
      },
    },
  },
  phantom: {
    id: 'phantom',
    name: 'PHANTOM',
    role: 'CONTROLLER',
    roleThai: 'สายคุมพื้นที่และลอบเร้น',
    accentColor: '#a855f7',
    tagline: 'วางหมอกควันนีออนปิดมุมยิง วาร์ปหลบมุม และเรียก Orbital Strike จากฟ้า',
    skills: {
      Q: {
        slot: 'Q',
        id: 'smoke',
        name: 'SHADOW SMOKE',
        thaiDesc: 'ปล่อยโดมหมอกควัน 3D บังสายตาศัตรูนาน 10 วิ',
        cooldownSec: 10,
        accentColor: '#c084fc',
      },
      C: {
        slot: 'C',
        id: 'blink',
        name: 'PHASE BLINK',
        thaiDesc: 'เทเลพอร์ตทะลุมิติไปข้างหน้าสูงสุด 10 เมตร',
        cooldownSec: 9,
        accentColor: '#a855f7',
      },
      X: {
        slot: 'X',
        id: 'orbital',
        name: 'ORBITAL STRIKE',
        thaiDesc: 'อัลติ: ยิงลำแสงไอออนจากท้องฟ้าทำดาเมจ 90 AOE ในจุดที่เล็ง',
        cooldownSec: 0,
        ultCost: ULT_MAX_POINTS,
        accentColor: '#e879f9',
      },
    },
  },
  pulse: {
    id: 'pulse',
    name: 'PULSE',
    role: 'INITIATOR',
    roleThai: 'สายสแกนและระเบิดพื้นที่',
    accentColor: '#fb923c',
    tagline: 'ปล่อยคลื่นโซนาร์มองเห็นศัตรูทะลุกำแพง ปาระเบิด และยิงจรวดพลาสมา',
    skills: {
      Q: {
        slot: 'Q',
        id: 'recon',
        name: 'RECON SONAR',
        thaiDesc: 'สแกนคลื่นโซนาร์เปิดเผยตำแหน่งศัตรูทะลุกำแพง 5.5 วิ',
        cooldownSec: 10,
        accentColor: '#fb923c',
      },
      C: {
        slot: 'C',
        id: 'cluster',
        name: 'SHOCK CLUSTER',
        thaiDesc: 'ยิงระเบิดพลาสมาทำดาเมจ 55 AOE ทะลุหลังที่กำบัง',
        cooldownSec: 11,
        accentColor: '#f97316',
      },
      X: {
        slot: 'X',
        id: 'barrage',
        name: 'HYPER BARRAGE',
        thaiDesc: 'อัลติ: ยิงจรวดพลาสมาแรงสูง 120 AOE ระเบิดศัตรูทันที',
        cooldownSec: 0,
        ultCost: ULT_MAX_POINTS,
        accentColor: '#fbbf24',
      },
    },
  },
}

export const AGENT_IDS: AgentId[] = ['vortex', 'aegis', 'phantom', 'pulse']
