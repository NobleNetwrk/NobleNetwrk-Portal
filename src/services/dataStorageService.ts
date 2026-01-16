// src/services/dataStorageService.ts
import { prisma } from '../lib/prisma';
import { LockedK9 } from '@prisma/client'; // FIXED: Import from standard location

export class DataStorageService {
  
  private calculateInterest(lock: LockedK9): number {
    const lockTime = new Date(lock.lockDate).getTime();
    const weeksPassed = Math.floor((Date.now() - lockTime) / (7 * 24 * 60 * 60 * 1000));
    // originalNTWRKAmount must exist in your schema
    return Math.round(lock.originalNTWRKAmount * Math.pow(1 + lock.interestRate / 100, weeksPassed));
  }

  async getAllLockedK9s(): Promise<LockedK9[]> {
    return await prisma.lockedK9.findMany({
      orderBy: { lockDate: 'desc' }
    });
  }

  async getLocksByUser(userWallet: string): Promise<LockedK9[]> {
    const locks = await prisma.lockedK9.findMany({
      where: { userWallet }
    });

    return locks.map(lock => {
      if (lock.unlocked) return lock;
      return {
        ...lock,
        currentUnlockCost: this.calculateInterest(lock)
      };
    });
  }

  async createLock(data: any): Promise<LockedK9> {
    // FIXED: Spread the 'data' object so fields like nftMint and originalNTWRKAmount are included
    return await prisma.lockedK9.create({
      data: {
        ...data,
        unlocked: false,
      }
    });
  }

  async forceUnlockK9(lockId: string, adminWallet: string, reason: string): Promise<LockedK9> {
    return await prisma.lockedK9.update({
      where: { id: lockId },
      data: {
        unlocked: true,
        unlockDate: new Date(),
        unlockSignature: `ADMIN_FORCE_RESCUE_${Date.now()}`,
      }
    });
  }
}

export const dataStorageService = new DataStorageService();