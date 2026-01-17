'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { encode } from 'bs58' 

// --- Types ---
interface UserStat {
  wallet: string
  totalAllocation: number
  lastCheckIn: string
}

interface Announcement {
  id: string
  title: string
  content: string
  date: string
  isActive: boolean
}

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')
const TOTAL_AIRDROP_SUPPLY = 5000000

export default function AdminConsole() {
  const { publicKey, connected, signMessage } = useWallet()
  const router = useRouter()
  
  // System State
  const [impoundRate, setImpoundRate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // User Stats State
  const [stats, setStats] = useState({ totalUsers: 0, totalAllocated: 0 })
  const [userList, setUserList] = useState<UserStat[]>([])
  const [showUserList, setShowUserList] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Announcement State
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', content: '' })

  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    if (!connected) return
    if (!ADMIN_WALLETS.includes(publicKey?.toBase58() || '')) {
      router.push('/Portal')
      toast.error('Unauthorized Access')
      return
    }

    Promise.all([
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/announcements').then(r => r.json())
    ]).then(([settingsData, statsData, announcementsData]) => {
      setImpoundRate(settingsData.value || '')
      setStats(statsData || { totalUsers: 0, totalAllocated: 0 })
      setAnnouncements(announcementsData.data || [])
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [connected, publicKey, router])

  // --- 2. SECURE ACTION HELPER ---
  const executeSecureAction = async (
    actionName: string, 
    apiEndpoint: string, 
    method: 'POST' | 'PUT' | 'DELETE', 
    payload: any
  ) => {
    if (!publicKey || !signMessage) return
    setProcessing(true)

    try {
      const timestamp = Date.now()
      const message = `Admin Authorization:\nAction: ${actionName}\nAdmin: ${publicKey.toBase58()}\nTS: ${timestamp}`
      
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = encode(signature) 

      const res = await fetch(apiEndpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...payload,
          adminWallet: publicKey.toBase58(),
          message,
          signature: signatureBase58 
        })
      })

      if (!res.ok) throw new Error(await res.text())
      
      const data = await res.json()
      toast.success(`${actionName} Successful`)
      return data

    } catch (err: any) {
      console.error(err)
      toast.error(`Action Failed: ${err.message || 'Unknown Error'}`)
      return null
    } finally {
      setProcessing(false)
    }
  }

  // --- 3. HANDLERS ---

  const handleUpdateSettings = async () => {
    await executeSecureAction('Update Settings', '/api/admin/settings', 'POST', { value: impoundRate })
  }

  const handleFetchUserList = async () => {
    if (showUserList) {
      setShowUserList(false) 
      return
    }
    setLoadingUsers(true)
    setShowUserList(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUserList(data.users || [])
    } catch (e) { toast.error("Could not fetch user list") } 
    finally { setLoadingUsers(false) }
  }

  // NEW: Export Handler
  const handleExportData = async () => {
    const data = await executeSecureAction('Export Airdrop Data', '/api/admin/export', 'POST', {})
    
    if (data && data.data) {
      // Convert JSON to Blob and force download
      const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
        JSON.stringify(data.data, null, 2)
      )}`;
      const link = document.createElement("a");
      link.href = jsonString;
      link.download = `noble_airdrop_snapshot_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      toast.success("Download Started");
    }
  }

  const handleSaveAnnouncement = async () => {
    if (!draft.title || !draft.content) return toast.warn("Title and content required")

    const action = isEditing ? 'Update Announcement' : 'Post Announcement'
    const method = isEditing ? 'PUT' : 'POST'
    const payload = isEditing ? { id: isEditing, ...draft } : { ...draft }

    const result = await executeSecureAction(action, '/api/admin/announcements', method, payload)
    
    if (result) {
      if (isEditing) {
        setAnnouncements(prev => prev.map(a => a.id === isEditing ? { ...a, ...draft } : a))
      } else {
        setAnnouncements(prev => [result.newAnnouncement, ...prev])
      }
      setDraft({ title: '', content: '' })
      setIsEditing(null)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Delete this announcement?")) return
    const result = await executeSecureAction('Delete Announcement', '/api/admin/announcements', 'DELETE', { id })
    if (result) {
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    }
  }

  const startEdit = (ann: Announcement) => {
    setDraft({ title: ann.title, content: ann.content })
    setIsEditing(ann.id)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  if (!connected) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-black uppercase">Connect Admin Wallet</div>
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner size="lg" /></div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-red-500/20 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase text-red-500 tracking-tighter">Admin Console</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2">Secure Command Environment</p>
          </div>
          <button onClick={() => router.push('/Portal')} className="text-xs font-bold text-gray-600 hover:text-white uppercase">Exit to Portal</button>
        </div>

        {/* 1. USER STATS & REGISTRY */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Card 1: Total Users */}
           <div className="bg-gray-900/60 border border-white/5 p-8 rounded-3xl flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1">Total Users</p>
                <p className="text-4xl font-black text-white">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleFetchUserList}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {showUserList ? 'Hide Registry' : 'View Registry'}
                </button>
                {/* EXPORT BUTTON */}
                <button 
                  onClick={handleExportData}
                  disabled={processing}
                  className="bg-green-900/20 border border-green-500/30 hover:bg-green-900/40 text-green-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Export Data (JSON)
                </button>
              </div>
           </div>
           
           {/* Card 2: Total Allocation */}
           <div className="bg-gray-900/60 border border-white/5 p-8 rounded-3xl">
              <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1">Total Airdrop Allocated</p>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-black text-blue-500">
                  {stats.totalAllocated.toLocaleString()} 
                  <span className="text-sm text-gray-600 ml-2">NTWRK</span>
                </p>
                <p className="text-lg font-bold text-green-500">
                  ({((stats.totalAllocated / TOTAL_AIRDROP_SUPPLY) * 100).toFixed(2)}%)
                </p>
              </div>
           </div>
        </section>

        {/* EXPANDABLE USER LIST */}
        {showUserList && (
          <div className="bg-gray-900 border border-white/10 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4">
            <div className="p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">User Registry</h3>
            </div>
            {loadingUsers ? (
              <div className="p-12 flex justify-center"><LoadingSpinner /></div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-widest sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="p-4">Wallet</th>
                      <th className="p-4">Allocated</th>
                      <th className="p-4 text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userList.map((user, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors font-mono text-xs">
                        <td className="p-4 text-gray-300">{user.wallet}</td>
                        <td className="p-4 text-blue-400 font-bold">{user.totalAllocation?.toLocaleString() || 0}</td>
                        <td className="p-4 text-right text-gray-600">
                          {user.lastCheckIn ? new Date(user.lastCheckIn).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. SYSTEM SETTINGS */}
        <section className="bg-gray-900 border border-red-500/20 p-8 rounded-3xl">
          <label className="text-xs text-red-500 uppercase font-black tracking-widest mb-4 block">System Constants</label>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3">
              <p className="text-[10px] text-gray-500 mb-2 font-bold">K9 Impound Payout Rate</p>
              <input 
                type="number" 
                value={impoundRate}
                onChange={(e) => setImpoundRate(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 w-full text-white font-mono focus:border-red-500/50 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
            <button 
              onClick={handleUpdateSettings} 
              disabled={processing}
              className="bg-red-900/20 border border-red-500/30 hover:bg-red-900/40 text-red-500 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all h-[46px]"
            >
              {processing ? 'Signing...' : 'Update Constant'}
            </button>
          </div>
        </section>

        {/* 3. ANNOUNCEMENTS MANAGER */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* List of Announcements */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">Live Announcements</h3>
            {announcements.length === 0 ? (
              <p className="text-gray-600 italic text-sm">No active announcements.</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="bg-gray-900/80 border border-white/5 p-6 rounded-2xl group hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg text-white">{ann.title}</h4>
                    <span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${ann.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {ann.isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{ann.content}</p>
                  <div className="flex gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(ann)} className="text-[10px] font-bold text-blue-400 uppercase hover:underline">Edit</button>
                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-[10px] font-bold text-red-400 uppercase hover:underline">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Editor */}
          <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-3xl h-fit sticky top-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-6">
              {isEditing ? 'Edit Announcement' : 'New Announcement'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Title</label>
                <input 
                  value={draft.title}
                  onChange={e => setDraft({...draft, title: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500/50 outline-none"
                  placeholder="e.g. System Maintenance"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Content</label>
                <textarea 
                  value={draft.content}
                  onChange={e => setDraft({...draft, content: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm mt-1 h-32 resize-none focus:border-blue-500/50 outline-none"
                  placeholder="Details..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleSaveAnnouncement}
                  disabled={processing}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg"
                >
                  {processing ? 'Signing...' : (isEditing ? 'Update' : 'Post Live')}
                </button>
                {isEditing && (
                  <button 
                    onClick={() => { setIsEditing(null); setDraft({ title: '', content: '' }) }}
                    className="px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-400"
                  >
                    X
                  </button>
                )}
              </div>
            </div>
          </div>

        </section>

      </div>
    </main>
  )
}