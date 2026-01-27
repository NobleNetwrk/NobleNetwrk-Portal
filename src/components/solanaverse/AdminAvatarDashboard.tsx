"use client"
import { useState, useEffect } from 'react'

export default function AdminAvatarDashboard({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Load requests
  useEffect(() => {
    fetch('/api/admin/avatars')
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests || [])
        setLoading(false)
      })
  }, [])

  const handleGrant = async (req: any, avatarCodeId: string) => {
    if(!avatarCodeId) return alert("Enter the Avatar ID code first!");
    
    // FIX: Add safety check for wallet
    if (!req.wallet) return alert("Error: No wallet attached to this request.");

    try {
        const res = await fetch('/api/admin/avatars', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                wallet: req.wallet,
                requestId: req.id,
                avatarId: avatarCodeId 
            })
        })
        
        if (res.ok) {
            alert(`Granted ${avatarCodeId} to ${req.wallet}!`);
            setRequests(prev => prev.map(r => r.id === req.id ? {...r, status: 'GRANTED'} : r));
        } else {
            alert("Error granting avatar");
        }
    } catch (e) {
        alert("Network error");
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-8 backdrop-blur-sm">
        <div className="bg-[#111] border border-yellow-600/50 w-full max-w-5xl h-[80vh] flex flex-col rounded-2xl shadow-2xl relative">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] rounded-t-2xl">
                <h2 className="text-2xl font-bold text-yellow-500 uppercase flex items-center gap-2">
                    👑 Avatar Request Queue
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="text-white text-center mt-10">Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div className="text-gray-500 text-center mt-10">No pending requests found.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-xs uppercase border-b border-white/10">
                                <th className="p-3">Date</th>
                                <th className="p-3">User</th>
                                <th className="p-3">Requested NFT</th>
                                <th className="p-3">Reference</th>
                                <th className="p-3">Action (Grant ID)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(req => (
                                <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-gray-400 text-xs">
                                        {req.date ? new Date(req.date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    
                                    {/* FIX: Safe Access for Wallet Slice */}
                                    <td className="p-3 text-white text-xs font-mono">
                                        {req.wallet 
                                            ? `${req.wallet.slice(0,6)}...${req.wallet.slice(-4)}`
                                            : <span className="text-red-500">Unknown Wallet</span>
                                        }
                                    </td>

                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            {req.nftImage && (
                                                <img src={req.nftImage} className="w-8 h-8 rounded bg-gray-800 object-cover" />
                                            )}
                                            <span className="text-white text-sm font-bold">{req.nftName || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {req.nftImage && (
                                            <a href={req.nftImage} target="_blank" className="text-blue-400 hover:text-blue-300 text-xs underline">
                                                View Image
                                            </a>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {req.status === 'PENDING' ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    id={`input-${req.id}`}
                                                    placeholder="e.g. panda_42" 
                                                    className="bg-black border border-white/20 text-white text-xs p-2 rounded w-32 focus:border-yellow-500 outline-none"
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const input = document.getElementById(`input-${req.id}`) as HTMLInputElement;
                                                        handleGrant(req, input.value);
                                                    }}
                                                    className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded font-bold uppercase"
                                                >
                                                    Grant
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-green-500 font-bold text-xs border border-green-500/30 px-2 py-1 rounded bg-green-500/10">
                                                GRANTED
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    </div>
  )
}