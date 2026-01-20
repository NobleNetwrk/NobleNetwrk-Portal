'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { 
    PublicKey, 
    Transaction, 
    SystemProgram, 
    TransactionInstruction, 
    ComputeBudgetProgram,
    Keypair,
    LAMPORTS_PER_SOL 
} from '@solana/web3.js'
import { 
  TOKEN_PROGRAM_ID, 
  createTransferInstruction, 
  createCloseAccountInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

// --- CONFIG ---
const COMMUNITY_OPTIONS = [
  { id: 'portal_users', label: 'Registered Portal Users', type: 'special' },
  { id: 'genetics', label: 'Noble Genetics Holders', type: 'nft' },
  { id: 'extracts', label: 'Noble Extracts Holders', type: 'nft' },
  { id: 'namaste', label: 'Namaste Holders', type: 'nft' },
  { id: 'solanaK9s', label: 'Solana K9 Holders', type: 'nft' },
  { id: 'sensei', label: 'Sensei Panda Holders', type: 'nft' },
  { id: 'tso', label: 'The Smoke Out Holders', type: 'nft' },
  { id: 'd3fenders', label: 'D3fenders Holders', type: 'nft' },
  { id: 'stonedApeCrew', label: 'Stoned Ape Crew Holders', type: 'nft' },
  { id: 'immortalGeckos', label: 'Immortal Geckos Holders', type: 'nft' },
  { id: 'timeTravelingChimps', label: 'Time Traveling Chimps', type: 'nft' },
  { id: 'player1', label: 'Player 1', type: 'nft' },
];

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb");

// Admin Override (Matches NewMember.tsx)
const ADMIN_WALLETS = [
  '6cAE4yDUBShFPRVUyK6cC5guVuFWxGtMc7qx1Kbz3vUr',
  'CsdeLiQJwWUDnhzoaqnVSW8KiFRTLnTqtA9cou4Fpmwd'
];

interface TokenAccount {
  mint: string;
  name: string;   
  symbol: string; 
  balance: number;
  decimals: number;
  price?: number; 
  value?: number; 
}

interface Recipient {
  address: string;
  count: number; 
}

export default function AirdropTool() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const router = useRouter();

  // --- AUTH STATE ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // --- TOOL STATE ---
  const [step, setStep] = useState(1); 
  const [userTokens, setUserTokens] = useState<TokenAccount[]>([]);
  const [selectedTokenMint, setSelectedTokenMint] = useState<string>(''); 
  const [totalAirdropAmount, setTotalAirdropAmount] = useState<string>('');
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [totalWeight, setTotalWeight] = useState(0); 
  
  const [burnerKeypair, setBurnerKeypair] = useState<Keypair | null>(null);
  
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [isFetchingRecipients, setIsFetchingRecipients] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(true);

  const selectedToken = userTokens.find(t => t.mint === selectedTokenMint) || null;

  // --- AUTHENTICATION CHECK ---
  useEffect(() => {
    const checkAccess = async () => {
        if (!publicKey) return;
        setIsCheckingAuth(true);

        const walletAddress = publicKey.toBase58();

        // 1. Immediate Admin Bypass
        if (ADMIN_WALLETS.includes(walletAddress)) {
            setIsAuthorized(true);
            setIsCheckingAuth(false);
            return;
        }

        try {
            // 2. Check User Database
            const res = await fetch(`/api/members?walletAddress=${walletAddress}`);
            if (res.ok) {
                const data = await res.json();
                // Check for 'isAirdropApproved' field (We will add this to DB next)
                if (data.member && data.member.isAirdropApproved) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } else {
                setIsAuthorized(false);
            }
        } catch (e) {
            console.error("Auth Check Failed", e);
            setIsAuthorized(false);
        } finally {
            setIsCheckingAuth(false);
        }
    };

    if (publicKey) {
        checkAccess();
    } else {
        setIsCheckingAuth(false);
    }
  }, [publicKey]);


  // --- COST ESTIMATION ---
  const estCost = useMemo(() => {
    if (!recipients.length) return { fee: 0, rent: 0, total: 0, isSol: false };
    
    const BATCH_SIZE = 12; 
    const numBatches = Math.ceil(recipients.length / BATCH_SIZE);
    
    const baseFee = numBatches * 0.000005; 
    const rentPerAccount = 0.00203928; 
    const isSol = selectedToken?.symbol === 'SOL';
    const maxRent = isSol ? 0 : recipients.length * rentPerAccount;
    const buffer = 0.002; 

    return {
        fee: baseFee + buffer,
        rent: maxRent,
        total: baseFee + maxRent + buffer,
        isSol
    };
  }, [recipients.length, selectedToken]);

  // --- 1. FETCH TOKENS & PRICES (Only if authorized) ---
  useEffect(() => {
    if (!publicKey || !isAuthorized) return;

    const fetchTokens = async () => {
      try {
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID
        });
        
        const initialTokens: TokenAccount[] = accounts.value.map((item: any) => {
          const info = item.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.uiAmount,
            decimals: info.tokenAmount.decimals,
            name: 'Unknown',     
            symbol: info.mint.slice(0, 4) + '...', 
          };
        }).filter((t: TokenAccount) => t.balance > 0);

        const solBalance = await connection.getBalance(publicKey);
        initialTokens.push({
            mint: 'So11111111111111111111111111111111111111112',
            balance: solBalance / 1e9,
            decimals: 9,
            name: 'Solana',
            symbol: 'SOL'
        });

        initialTokens.sort((a, b) => b.balance - a.balance);
        setUserTokens(initialTokens);

        fetchOnChainMetadata(initialTokens);
        fetchTokenPrices(initialTokens);

      } catch (e) { console.error("Token fetch error", e); }
    };

    fetchTokens();
  }, [publicKey, connection, isAuthorized]);

  const fetchOnChainMetadata = async (tokens: TokenAccount[]) => {
    const tokensToFetch = tokens.filter(t => t.symbol !== 'SOL');
    if (tokensToFetch.length === 0) return;
    try {
      const pdas = tokensToFetch.map(t => 
        PublicKey.findProgramAddressSync(
          [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), new PublicKey(t.mint).toBuffer()],
          METADATA_PROGRAM_ID
        )[0]
      );
      const accountInfos = await connection.getMultipleAccountsInfo(pdas.slice(0, 99));
      const updates = new Map<string, { name: string, symbol: string }>();
      accountInfos.forEach((info: any, index: number) => {
          if (info) {
              try { const data = decodeMetadata(info.data); updates.set(tokensToFetch[index].mint, data); } catch (e) {}
          }
      });
      setUserTokens(prev => prev.map(t => { const update = updates.get(t.mint); if (update) return { ...t, name: update.name, symbol: update.symbol }; return t; }));
    } catch (e) { console.warn("Metadata fetch error", e); }
  };

  const fetchTokenPrices = async (tokens: TokenAccount[]) => {
      try {
          const mints = tokens.map(t => t.mint).slice(0, 50).join(',');
          if (!mints) return;
          const response = await fetch(`/api/prices?ids=${mints}`);
          if (!response.ok) return; 
          const data = await response.json();
          if (data && data.data) {
              setUserTokens(prev => {
                  const updated = prev.map(t => {
                      const priceData = data.data[t.mint];
                      return { ...t, price: priceData ? priceData.price : 0, value: t.balance * (priceData ? priceData.price : 0) };
                  });
                  return updated.sort((a, b) => { const valA = a.value || 0; const valB = b.value || 0; if (valA > 0 || valB > 0) return valB - valA; return b.balance - a.balance; });
              });
          }
      } catch (e) { console.error("Price fetch error", e); }
  };

  const decodeMetadata = (buffer: Buffer) => {
    let offset = 1 + 32 + 32; const nameLen = buffer.readUInt32LE(offset); offset += 4; const name = buffer.toString('utf8', offset, offset + nameLen).replace(/\0/g, ''); offset += nameLen; const symbolLen = buffer.readUInt32LE(offset); offset += 4; const symbol = buffer.toString('utf8', offset, offset + symbolLen).replace(/\0/g, ''); offset += symbolLen; return { name, symbol };
  }

  // --- ANALYZE & AIRDROP FUNCTIONS (Unchanged logic, just ensure Authorized) ---
  const handleAnalyze = async () => {
    if (!isAuthorized) return;
    if (!selectedToken || !totalAirdropAmount || selectedCommunities.length === 0) {
      toast.warn("Please select a token, amount, and at least one community.");
      return;
    }

    setIsFetchingRecipients(true);
    setLogs([]);

    try {
        const res = await fetch('/api/snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                communities: selectedCommunities,
                includePortalUsers: selectedCommunities.includes('portal_users')
            })
        });

        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch snapshots');

        if (data.recipients && data.totalWeight) {
            const sorted = data.recipients.sort((a: Recipient, b: Recipient) => b.count - a.count);
            setRecipients(sorted); 
            setTotalWeight(data.totalWeight); 
            
            if (sorted.length === 0) {
                 toast.error("No holders found.");
                 setIsFetchingRecipients(false);
                 return;
            }
            
            const newBurner = Keypair.generate();
            setBurnerKeypair(newBurner);
            setShowHelp(false);
            
            setStep(2); 
        } else {
            throw new Error("Invalid response format");
        }

    } catch (e) {
        console.error(e);
        toast.error("Failed to generate recipient list.");
    } finally {
        setIsFetchingRecipients(false);
    }
  };

  const downloadBurnerKey = () => {
      if (!burnerKeypair) return;
      const secretKeyArray = Array.from(burnerKeypair.secretKey);
      const blob = new Blob([JSON.stringify(secretKeyArray)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noble-airdrop-key-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.info("Keypair downloaded! Keep this safe.");
  };

  const executeAirdrop = async () => {
    if (!publicKey || !selectedToken || !burnerKeypair || !isAuthorized) return;
    setIsExecuting(true);
    
    const amountPerUnit = parseFloat(totalAirdropAmount) / totalWeight;
    const isSol = selectedToken.symbol === 'SOL';
    const decimals = selectedToken.decimals;
    const burnerPubkey = burnerKeypair.publicKey;

    if (amountPerUnit <= 0 || isNaN(amountPerUnit)) {
        toast.error("Invalid calculation: Amount per user is 0.");
        setIsExecuting(false);
        return;
    }

    const BATCH_SIZE = 12; 
    const batches = [];
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        batches.push(recipients.slice(i, i + BATCH_SIZE));
    }

    setProgress({ current: 0, total: batches.length });
    
    try {
        const totalTokensNeeded = recipients.reduce((acc, r) => acc + (r.count * amountPerUnit), 0);
        const estimatedRent = isSol ? 0 : recipients.length * 0.002039 * LAMPORTS_PER_SOL;
        const txFees = batches.length * 0.000010 * LAMPORTS_PER_SOL; 
        const safetyBuffer = 0.015 * LAMPORTS_PER_SOL; 

        const totalSolNeeded = estimatedRent + txFees + safetyBuffer + (isSol ? totalTokensNeeded * LAMPORTS_PER_SOL : 0);

        const fundTx = new Transaction();
        fundTx.add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: burnerPubkey,
                lamports: Math.ceil(totalSolNeeded)
            })
        );

        let burnerATA = null;
        if (!isSol) {
            const mintPubkey = new PublicKey(selectedToken.mint);
            const userATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
            burnerATA = await getAssociatedTokenAddress(mintPubkey, burnerPubkey);

            fundTx.add(
                createAssociatedTokenAccountInstruction(publicKey, burnerATA, burnerPubkey, mintPubkey)
            );

            const tokenAmountRaw = Math.ceil(totalTokensNeeded * Math.pow(10, decimals));
            fundTx.add(
                createTransferInstruction(userATA, burnerATA, publicKey, tokenAmountRaw)
            );
        }

        const { blockhash } = await connection.getLatestBlockhash();
        fundTx.recentBlockhash = blockhash;
        fundTx.feePayer = publicKey;

        toast.info(`Funding Airdrop Wallet... Please Confirm.`);
        const fundSig = await sendTransaction(fundTx, connection);
        await connection.confirmTransaction(fundSig, 'confirmed');
        setLogs(prev => [`✅ Funding Confirmed: ${fundSig.slice(0,8)}...`, ...prev]);

        const sourceMint = new PublicKey(selectedToken.mint);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const tx = new Transaction();
            
            tx.add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
            );

            tx.add({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from("Airdropped using NobleNetwrk Portal", "utf-8") });

            let destAtas: PublicKey[] = [];
            let existingAccounts: boolean[] = [];

            if (!isSol) {
                destAtas = await Promise.all(
                    batch.map(r => getAssociatedTokenAddress(sourceMint, new PublicKey(r.address), true))
                );
                const accountsInfo = await connection.getMultipleAccountsInfo(destAtas);
                existingAccounts = accountsInfo.map((info: any) => info !== null);
            }

            for (let j = 0; j < batch.length; j++) {
                const recipient = batch[j];
                const recipientPubkey = new PublicKey(recipient.address);
                const userAmount = amountPerUnit * recipient.count;
                const rawAmount = Math.floor(userAmount * Math.pow(10, decimals));

                if (rawAmount <= 0) continue;

                if (isSol) {
                    tx.add(SystemProgram.transfer({
                        fromPubkey: burnerPubkey, 
                        toPubkey: recipientPubkey,
                        lamports: rawAmount
                    }));
                } else {
                    if (!burnerATA) throw new Error("Burner ATA missing");
                    const destATA = destAtas[j];
                    
                    if (!existingAccounts[j]) {
                        tx.add(createAssociatedTokenAccountInstruction(burnerPubkey, destATA, recipientPubkey, sourceMint));
                    }
                    tx.add(createTransferInstruction(burnerATA, destATA, burnerPubkey, rawAmount));
                }
            }

            const latest = await connection.getLatestBlockhash();
            tx.recentBlockhash = latest.blockhash;
            tx.feePayer = burnerPubkey;
            tx.sign(burnerKeypair); 

            try {
                const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
                await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
                
                setLogs(prev => [`Batch ${i+1}/${batches.length} Sent: ${sig.slice(0,8)}...`, ...prev]);
                setProgress(prev => ({ ...prev, current: i + 1 }));
            } catch (err: any) {
                console.error(`Batch ${i+1} failed`, err);
                setLogs(prev => [`❌ Batch ${i+1} Failed! ${err.message}`, ...prev]);
            }
        }

        toast.info("Cleaning up & reclaiming leftovers...");
        try {
            const cleanupTx = new Transaction();
            
            if (!isSol) {
                const accounts = await connection.getParsedTokenAccountsByOwner(burnerPubkey, { programId: TOKEN_PROGRAM_ID });
                
                for (const acc of accounts.value) {
                    const info = acc.account.data.parsed.info;
                    const tokenBalance = info.tokenAmount.uiAmount;
                    const burnerATA = new PublicKey(acc.pubkey);
                    const mintAddr = new PublicKey(info.mint);

                    if (tokenBalance > 0) {
                        const userATA = await getAssociatedTokenAddress(mintAddr, publicKey);
                        const amountRaw = BigInt(info.tokenAmount.amount);
                        
                        cleanupTx.add(
                            createTransferInstruction(burnerATA, userATA, burnerPubkey, amountRaw)
                        );
                    }

                    cleanupTx.add(
                        createCloseAccountInstruction(burnerATA, publicKey, burnerPubkey)
                    );
                }
            }

            const balance = await connection.getBalance(burnerPubkey);
            const fee = 5000; 
            
            if (balance > fee) {
                cleanupTx.add(
                    SystemProgram.transfer({
                        fromPubkey: burnerPubkey,
                        toPubkey: publicKey, 
                        lamports: balance - fee
                    })
                );
            }

            const latest = await connection.getLatestBlockhash();
            cleanupTx.recentBlockhash = latest.blockhash;
            cleanupTx.feePayer = burnerPubkey;
            cleanupTx.sign(burnerKeypair);

            const cleanSig = await connection.sendRawTransaction(cleanupTx.serialize());
            await connection.confirmTransaction({ signature: cleanSig, ...latest }, 'confirmed');
            setLogs(prev => [`✅ Cleanup Complete: ${cleanSig.slice(0,8)}...`, ...prev]);

        } catch (e) { 
            console.warn("Cleanup failed", e);
            setLogs(prev => [`⚠️ Cleanup Warning: ${e}`, ...prev]);
        }

        toast.success("Airdrop Sequence Complete!");

    } catch (e: any) {
        console.error("Critical Error", e);
        toast.error(`Airdrop Error: ${e.message}`);
    } finally {
        setIsExecuting(false);
    }
  };

  const toggleCommunity = (id: string) => {
    setSelectedCommunities(prev => 
        prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // --- ACCESS CONTROL RENDERING ---
  if (!publicKey) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Please Connect Wallet</div>;

  if (isCheckingAuth) {
      return (
          <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">Verifying Clearance Level...</p>
              </div>
          </div>
      );
  }

  if (!isAuthorized) {
      return (
          <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-red-900/10 border border-red-500/20 rounded-3xl p-8 text-center backdrop-blur-xl">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Restricted Access</h1>
                  <p className="text-gray-400 text-sm mb-6">
                      The Airdrop Tool is a feature reserved for authorized NobleNetwrk users only.
                  </p>
                  <p className="text-xs text-gray-500 mb-8">
                      If you require access, please contact <span className="text-blue-400 font-bold">NobleNetwrk Administration</span> for approval.
                  </p>
                  <button onClick={() => router.push('/Portal')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold uppercase text-xs tracking-widest transition-colors">
                      Return to Portal
                  </button>
              </div>
          </main>
      );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div className="flex flex-col">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    Airdrop Tool
                </h1>
                <span className="text-[10px] text-gray-500 font-mono">v2.1 // Burner Protocol Active</span>
            </div>
            <button onClick={() => router.push('/Portal')} className="text-gray-500 hover:text-white text-xs font-bold uppercase">Back to Portal</button>
        </div>

        {/* --- HOW IT WORKS (NEW) --- */}
        {showHelp && (
            <div className="mb-8 bg-blue-900/10 border border-blue-500/20 p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-blue-400 font-bold uppercase text-sm tracking-widest">How It Works</h3>
                    <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white">✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-gray-300">
                    <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-blue-500 font-black mb-1">1. ANALYZE</div>
                        Select a token and target communities. We scan the blockchain to build a recipient list.
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-yellow-500/20">
                        <div className="text-yellow-500 font-black mb-1">2. SECURE</div>
                        We generate a temporary <strong>Airdrop Key</strong>. <span className="text-white underline">You MUST download this backup</span> in case the browser closes.
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-green-500 font-black mb-1">3. FUND & SEND</div>
                        Sign <strong>ONE transaction</strong> to fund the temporary wallet. It will automatically distribute assets to everyone.
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-purple-500 font-black mb-1">4. RECLAIM</div>
                        Once finished, any remaining SOL (dust) & Tokens are automatically refunded to your main wallet.
                    </div>
                </div>
            </div>
        )}

        {/* --- STEP 1: CONFIGURATION --- */}
        {step === 1 && (
            <div className="space-y-8 animate-in fade-in">
                <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">1. Select Asset</h2>
                    <div className="relative">
                        <select 
                            value={selectedTokenMint}
                            onChange={(e) => setSelectedTokenMint(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white appearance-none cursor-pointer hover:border-blue-500/50 transition-colors focus:outline-none focus:border-blue-500 font-mono text-sm"
                        >
                            <option value="" disabled>Select a token from your wallet...</option>
                            {userTokens.map((token) => (
                                <option key={token.mint} value={token.mint}>
                                    {token.symbol} ({token.balance.toLocaleString()}) 
                                    {token.value ? ` - $${token.value.toFixed(2)}` : ''} 
                                    {token.symbol === 'SOL' ? ' ⭐' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">2. Total Airdrop Amount</h2>
                    <input 
                        type="number" 
                        value={totalAirdropAmount}
                        onChange={(e) => setTotalAirdropAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-2xl font-mono focus:border-blue-500 outline-none transition-colors"
                    />
                </div>

                <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">3. Select Target Communities</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {COMMUNITY_OPTIONS.map((c) => (
                            <div 
                                key={c.id}
                                onClick={() => toggleCommunity(c.id)}
                                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedCommunities.includes(c.id) ? 'bg-purple-900/30 border-purple-500' : 'bg-black/20 border-white/5 hover:border-white/20'}`}
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedCommunities.includes(c.id) ? 'bg-purple-500 border-purple-500' : 'border-gray-600'}`}>
                                    {selectedCommunities.includes(c.id) && "✓"}
                                </div>
                                <span className="text-sm font-bold">{c.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={isFetchingRecipients}
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-blue-900/20 disabled:opacity-50"
                >
                    {isFetchingRecipients ? 'Scanning Snapshots...' : 'Analyze & Review'}
                </button>
            </div>
        )}

        {/* --- STEP 2: REVIEW & EXECUTE --- */}
        {step === 2 && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8">
                <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[2.5rem] border border-white/10 text-center relative">
                    
                    {/* SAFETY WARNING BANNER */}
                    <div className="absolute top-4 right-4 md:right-8 md:top-8 bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-center gap-2">
                        <span className="text-red-400 text-xs font-bold uppercase blink">Active Burner Session</span>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    </div>

                    <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mb-2">Ready to Drop</p>
                    <h2 className="text-5xl font-black text-white mb-2">{totalAirdropAmount} <span className="text-2xl text-gray-500">{selectedToken?.symbol}</span></h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
                        <div className="bg-white/5 p-4 rounded-xl">
                            <p className="text-gray-500 text-[10px] uppercase font-bold">
                                {selectedCommunities.includes('portal_users') ? 'Total Weight (Score+NFTs)' : 'Total NFTs'}
                            </p>
                            <p className="text-xl font-bold text-blue-400">{totalWeight.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl">
                            <p className="text-gray-500 text-[10px] uppercase font-bold">Amount Per Unit</p>
                            <p className="text-xl font-bold text-green-400">{(parseFloat(totalAirdropAmount) / totalWeight).toFixed(4)}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl text-left">
                            <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">Max Estimated Cost</p>
                            <p className="text-xl font-bold text-orange-400">~{estCost.total.toFixed(4)} SOL</p>
                            <div className="text-[10px] text-gray-500 mt-2 space-y-1 font-mono">
                                <div className="flex justify-between"><span>Network Fees:</span> <span>{estCost.fee.toFixed(5)}</span></div>
                                {!estCost.isSol && (
                                    <div className="flex justify-between text-orange-500/70"><span>Max Rent (New Accts):</span> <span>{estCost.rent.toFixed(4)}</span></div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl">
                        <div className="text-left">
                            <p className="text-yellow-500 text-xs font-bold uppercase mb-1">⚠ Critical Safety Step</p>
                            <p className="text-gray-400 text-[10px]">Download the key for the temporary wallet handling this airdrop. If your browser crashes, you can recover funds with this.</p>
                        </div>
                        <button 
                            onClick={downloadBurnerKey}
                            className="text-xs font-bold uppercase tracking-widest bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded shadow-lg shadow-yellow-900/20 transition-all flex items-center gap-2"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download Key
                        </button>
                    </div>

                    <div className="mt-4 text-center">
                        <button 
                            onClick={() => setShowRecipientList(!showRecipientList)}
                            className="text-xs text-gray-400 underline hover:text-white"
                        >
                            {showRecipientList ? 'Hide Recipient List' : 'View Recipient List'}
                        </button>
                    </div>

                    {showRecipientList && (
                        <div className="mt-4 bg-black/40 border border-white/10 rounded-xl max-h-64 overflow-y-auto text-left p-2">
                            {recipients.map((recipient, i) => (
                                <div key={i} className="flex justify-between items-center p-2 border-b border-white/5 text-xs font-mono last:border-0 hover:bg-white/5">
                                    <span className="text-gray-300">
                                        {i + 1}. {recipient.address.slice(0,4)}...{recipient.address.slice(-4)} 
                                        <span className="text-gray-500 ml-2">({recipient.count} Weight)</span>
                                    </span>
                                    <span className="text-green-500">
                                        {((parseFloat(totalAirdropAmount) / totalWeight) * recipient.count).toFixed(4)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setStep(1)}
                        className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold uppercase text-xs"
                    >
                        Back
                    </button>
                    <button 
                        onClick={executeAirdrop}
                        disabled={isExecuting}
                        className="flex-[2] py-4 bg-green-600 hover:bg-green-500 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-green-900/20"
                    >
                        {isExecuting ? 'Distributing...' : `Auto-Send All (1-Click)`}
                    </button>
                </div>

                {(isExecuting || logs.length > 0) && (
                    <div className="bg-black/50 p-6 rounded-2xl border border-white/10 font-mono text-xs max-h-64 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 text-gray-400 uppercase font-bold">
                            <span>Progress</span>
                            <span>{progress.current} / {progress.total} Batches</span>
                        </div>
                        <div className="w-full bg-gray-800 h-2 rounded-full mb-4 overflow-hidden">
                            <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                        </div>
                        <div className="space-y-1">
                            {logs.map((log, i) => (
                                <p key={i} className={log.includes('Failed') ? 'text-red-400' : 'text-green-400'}>{log}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </main>
  );
}