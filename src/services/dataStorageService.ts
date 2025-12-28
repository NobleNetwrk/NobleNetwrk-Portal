import fs from 'fs'
import path from 'path'

export interface LockedK9 {
  id: string
  userWallet: string
  nftMint: string
  nftName: string
  nftImage: string
  lockDate: string
  originalNTWRKAmount: number
  interestRate: number
  currentUnlockCost: number
  unlocked: boolean
  unlockDate?: string
  unlockSignature?: string
  lastInterestUpdate: string
  adminMetadata?: {
    adminWallet: string
    reason: string
    timestamp: string
    action: string
  }
}

interface LockedK9sData {
  lockedK9s: LockedK9[]
  lastUpdated: string
}

const DATA_DIR = path.join(process.cwd(), 'data', 'locks')
const MAIN_DATA_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json')

export class DataStorageService {
  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  private getUserLockFile(userWallet: string): string {
    const safeWallet = userWallet.replace(/[^a-zA-Z0-9]/g, '_')
    return path.join(DATA_DIR, `${safeWallet}.json`)
  }

  private readUserLocks(userWallet: string): LockedK9[] {
    this.ensureDataDir()
    const userFile = this.getUserLockFile(userWallet)
    try {
      if (!fs.existsSync(userFile)) return []
      return JSON.parse(fs.readFileSync(userFile, 'utf-8')).lockedK9s || []
    } catch { return [] }
  }

  private writeUserLocks(userWallet: string, locks: LockedK9[]): void {
    this.ensureDataDir()
    const data: LockedK9sData = { lockedK9s: locks, lastUpdated: new Date().toISOString() }
    fs.writeFileSync(this.getUserLockFile(userWallet), JSON.stringify(data, null, 2))
  }

  private updateMainDatabase(lock: LockedK9, action: 'add' | 'update' | 'remove'): void {
    try {
      let allData: LockedK9sData = { lockedK9s: [], lastUpdated: new Date().toISOString() }
      if (fs.existsSync(MAIN_DATA_FILE)) allData = JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8'))
      
      if (action === 'add') {
        if (!allData.lockedK9s.find(l => l.id === lock.id)) allData.lockedK9s.push(lock)
      } else if (action === 'update') {
        const index = allData.lockedK9s.findIndex(l => l.id === lock.id)
        if (index !== -1) allData.lockedK9s[index] = lock
      } else if (action === 'remove') {
        allData.lockedK9s = allData.lockedK9s.filter(l => l.id !== lock.id)
      }
      
      fs.writeFileSync(MAIN_DATA_FILE, JSON.stringify(allData, null, 2))
    } catch (e) { console.error('Main DB Error:', e) }
  }

  async forceUnlockK9(lockId: string, adminWallet: string, reason: string): Promise<void> {
    const allLocks = await this.getAllLockedK9s()
    const lock = allLocks.find(l => l.id === lockId)
    if (!lock) throw new Error(`Lock not found: ${lockId}`)

    const updatedLock: LockedK9 = {
      ...lock,
      unlocked: true,
      unlockDate: new Date().toISOString(),
      unlockSignature: `ADMIN_FORCE_RESCUE_${Date.now()}`,
      adminMetadata: { adminWallet, reason, timestamp: new Date().toISOString(), action: 'force_unlock' }
    }

    await this.updateLock(updatedLock)
  }

  private updateInterest(lock: LockedK9): LockedK9 {
    const lockTime = new Date(lock.lockDate).getTime()
    const weeksPassed = Math.floor((Date.now() - lockTime) / (7 * 24 * 60 * 60 * 1000))
    const newUnlockCost = Math.round(lock.originalNTWRKAmount * Math.pow(1 + lock.interestRate / 100, weeksPassed))
    
    return { ...lock, currentUnlockCost: newUnlockCost, lastInterestUpdate: new Date().toISOString() }
  }

  async getAllLockedK9s(): Promise<LockedK9[]> {
    if (!fs.existsSync(MAIN_DATA_FILE)) return []
    try {
      return JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8')).lockedK9s || []
    } catch { return [] }
  }

  async updateLock(lock: LockedK9): Promise<void> {
    const userLocks = this.readUserLocks(lock.userWallet)
    const index = userLocks.findIndex(l => l.id === lock.id)
    if (index !== -1) {
      userLocks[index] = lock
      this.writeUserLocks(lock.userWallet, userLocks)
      this.updateMainDatabase(lock, 'update')
    }
  }

  async getLocksByUser(userWallet: string): Promise<LockedK9[]> {
    const userLocks = this.readUserLocks(userWallet)
    return userLocks.map(lock => lock.unlocked ? lock : this.updateInterest(lock))
  }
}

export const dataStorageService = new DataStorageService()