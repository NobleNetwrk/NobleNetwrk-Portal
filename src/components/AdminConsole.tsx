'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'

// Admin wallet addresses
const ADMIN_WALLETS = [
  '6cAE4yDUBShFPRVUyK6cC5guVuFWxGtMc7qx1Kbz3vUr',
  'CsdeLiQJwWUDnhzoaqnVSW8KiFRTLnTqtA9cou4Fpmwd'
]

interface LockedK9 {
  id: string
  userWallet: string
  nftMint: string
  nftName: string
  nftImage: string
  lockDate: string
  originalNTWRKAmount: number
  currentUnlockCost: number
  unlocked: boolean
  unlockDate?: string
  unlockSignature?: string
  lastInterestUpdate: string
}

interface SystemStats {
  totalLocked: number
  totalNTWRKIssued: number
  totalInterestOwed: number
  hotWalletBalance: number
}

export default function AdminConsole() {
  const { publicKey, connected } = useWallet()
  const [isAdmin, setIsAdmin] = useState(false)
  const [showConsole, setShowConsole] = useState(false)
  const [lockedK9s, setLockedK9s] = useState<LockedK9[]>([])
  const [stats, setStats] = useState<SystemStats>({
    totalLocked: 0,
    totalNTWRKIssued: 0,
    totalInterestOwed: 0,
    hotWalletBalance: 0
  })
  const [loading, setLoading] = useState(false)
  const [filterUnlocked, setFilterUnlocked] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Check if connected wallet is admin
  useEffect(() => {
    if (publicKey && ADMIN_WALLETS.includes(publicKey.toString())) {
      setIsAdmin(true)
    } else {
      setIsAdmin(false)
      setShowConsole(false)
    }
  }, [publicKey])

  // Fetch admin data
  const fetchAdminData = async () => {
    if (!publicKey || !isAdmin) return

    setLoading(true)
    try {
      // Fetch all locked K9s
      const locksResponse = await fetch('/api/admin/locked-k9s')
      const locksData = await locksResponse.json()
      
      if (locksData.success) {
        setLockedK9s(locksData.lockedK9s)
      } else {
        throw new Error(locksData.error)
      }

      // Fetch system stats
      const statsResponse = await fetch('/api/admin/stats')
      const statsData = await statsResponse.json()
      
      if (statsData.success) {
        setStats(statsData.stats)
      } else {
        throw new Error(statsData.error)
      }

      toast.success('Admin data loaded')
    } catch (error: any) {
      console.error('Error fetching admin data:', error)
      toast.error(`Failed to load admin data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Load data when console is shown
  useEffect(() => {
    if (showConsole && isAdmin) {
      fetchAdminData()
    }
  }, [showConsole, isAdmin])

  // Refresh data
  const refreshData = async () => {
    await fetchAdminData()
    toast.success('Admin data refreshed')
  }

  // Force unlock a K9 (admin override)
  const handleForceUnlock = async (lockId: string, nftMint: string) => {
    if (!confirm('Are you sure you want to force unlock this K9? This should only be used in emergencies.')) {
      return
    }

    try {
      const response = await fetch('/api/admin/force-unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lockId,
          nftMint,
          reason: 'Admin override'
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(`Force unlocked ${nftMint}`)
        await refreshData()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      console.error('Error force unlocking:', error)
      toast.error(`Failed to force unlock: ${error.message}`)
    }
  }

  // Export data to CSV
  const exportToCSV = () => {
    const filteredK9s = lockedK9s.filter(lock => 
      (filterUnlocked ? lock.unlocked : true) &&
      (searchTerm ? 
        lock.userWallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lock.nftMint.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lock.nftName.toLowerCase().includes(searchTerm.toLowerCase())
        : true
      )
    )

    const csvContent = [
      ['ID', 'User Wallet', 'NFT Mint', 'NFT Name', 'Lock Date', 'Original NTWRK', 'Current Cost', 'Unlocked', 'Unlock Date'],
      ...filteredK9s.map(lock => [
        lock.id,
        lock.userWallet,
        lock.nftMint,
        lock.nftName,
        new Date(lock.lockDate).toLocaleDateString(),
        lock.originalNTWRKAmount.toString(),
        lock.currentUnlockCost.toString(),
        lock.unlocked ? 'Yes' : 'No',
        lock.unlockDate ? new Date(lock.unlockDate).toLocaleDateString() : ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `k9-impound-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Filtered locked K9s
  const filteredK9s = lockedK9s.filter(lock => 
    (filterUnlocked ? lock.unlocked : !lock.unlocked) &&
    (searchTerm ? 
      lock.userWallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lock.nftMint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lock.nftName.toLowerCase().includes(searchTerm.toLowerCase())
      : true
    )
  )

  if (!isAdmin) return null

  return (
    <div className="mt-8">
      {/* Admin Console Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowConsole(!showConsole)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {showConsole ? 'Hide Admin Console' : 'Show Admin Console'}
        </button>
      </div>

      {/* Admin Console Content */}
      {showConsole && (
        <div className="bg-gray-900 text-white rounded-xl border border-purple-500 p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-purple-300 mb-2">Admin Console</h2>
              <p className="text-gray-400">Connected as: {publicKey?.toString()}</p>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
              <button
                onClick={refreshData}
                disabled={loading}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.836 3a8.001 8.001 0 00-15.836-3L4 12m14.004 6.183L18 9.227m-1.722-1.722A8.001 8.001 0 004 12m14.004 6.183L18 15.227" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              
              <button
                onClick={exportToCSV}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          {/* System Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Total Locked K9s</h3>
              <div className="text-2xl font-bold text-white">{stats.totalLocked}</div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1">NTWRK Issued</h3>
              <div className="text-2xl font-bold text-green-400">{stats.totalNTWRKIssued.toLocaleString()}</div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Interest Owed</h3>
              <div className="text-2xl font-bold text-yellow-400">{stats.totalInterestOwed.toLocaleString()}</div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Hot Wallet Balance</h3>
              <div className="text-2xl font-bold text-purple-400">{stats.hotWalletBalance.toLocaleString()} NTWRK</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by wallet, NFT mint, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filterUnlocked}
                    onChange={(e) => setFilterUnlocked(e.target.checked)}
                    className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Show Unlocked Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Locked K9s Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredK9s.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No locked K9s found
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-800">
                <thead>
                  <tr className="text-left text-sm font-medium text-gray-400">
                    <th className="px-4 py-3">NFT Name</th>
                    <th className="px-4 py-3">User Wallet</th>
                    <th className="px-4 py-3">Lock Date</th>
                    <th className="px-4 py-3">NTWRK Issued</th>
                    <th className="px-4 py-3">Current Cost</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredK9s.map((lock) => (
                    <tr key={lock.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full overflow-hidden mr-3">
                            <img
                              src={lock.nftImage || '/solana-k9s-icon.png'}
                              alt={lock.nftName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/solana-k9s-icon.png'
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-medium text-white">{lock.nftName}</div>
                            <div className="text-xs text-gray-400 font-mono">
                              {lock.nftMint.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-gray-300">
                          {lock.userWallet.slice(0, 8)}...{lock.userWallet.slice(-8)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {new Date(lock.lockDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-green-400 font-medium">
                          {lock.originalNTWRKAmount.toLocaleString()} NTWRK
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-yellow-400 font-medium">
                          {lock.currentUnlockCost.toLocaleString()} NTWRK
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lock.unlocked 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {lock.unlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!lock.unlocked && (
                          <button
                            onClick={() => handleForceUnlock(lock.id, lock.nftMint)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium"
                          >
                            Force Unlock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Info */}
          {filteredK9s.length > 0 && (
            <div className="mt-4 text-sm text-gray-400">
              Showing {filteredK9s.length} of {lockedK9s.length} total K9s
            </div>
          )}
        </div>
      )}
    </div>
  )
}