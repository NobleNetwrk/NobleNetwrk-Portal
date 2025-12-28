import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

interface Props {
  wallets: string[]
  activeWallet: string
  onLink: () => void
  onUnlink: (address: string) => void
}

export default function WalletLinkManager({ wallets, activeWallet, onLink, onUnlink }: Props) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-[2rem] p-6 mb-12 shadow-inner">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">Wallet Registry</h3>
          <p className="text-[10px] text-gray-500 uppercase font-bold">Manage aggregated vault addresses</p>
        </div>
        <button 
          onClick={onLink}
          className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"
        >
          <PlusIcon className="w-3 h-3" />
          Link Current Wallet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wallets.map((wallet) => (
          <div 
            key={wallet} 
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
              activeWallet === wallet 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-black/40 border-white/5'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-gray-300">
                {wallet.slice(0, 6)}...{wallet.slice(-6)}
              </span>
              {activeWallet === wallet && (
                <span className="text-[8px] text-blue-400 font-black uppercase tracking-tighter">Current Active</span>
              )}
            </div>
            
            {/* Prevent unlinking the currently active login wallet */}
            {activeWallet !== wallet && (
              <button 
                onClick={() => onUnlink(wallet)}
                className="p-2 hover:bg-red-500/20 text-gray-600 hover:text-red-400 rounded-lg transition-colors"
                title="Unlink Wallet"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}