"use client"
import React, { Suspense, useState, useEffect, useCallback } from 'react'
import { Box, Text, MeshReflectorMaterial, Cylinder } from '@react-three/drei'
import * as THREE from 'three'
import { VersionedTransaction, Transaction } from '@solana/web3.js' 
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-toastify'; 
import { RigidBody, CuboidCollider } from '@react-three/rapier' 

// --- UTILS ---
const cleanUrl = (url: string) => {
  if (!url || url.includes('undefined') || url.includes('mp4')) return "/ntwrk-logo.png";
  if (url.startsWith("ipfs://")) return url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
  if (url.includes("nftstorage.link")) {
    const match = url.match(/bafy[a-zA-Z0-9]+/);
    if (match) return `https://cloudflare-ipfs.com/ipfs/${match[0]}`;
  }
  return url;
};

function SafeImageMaterial({ url, opacity = 1, transparent = false }: { url: string, opacity?: number, transparent?: boolean }) {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!url) return;
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = "Anonymous";
        loader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter; 
            setTexture(tex);
        }, undefined, () => console.warn("Failed texture:", url));
        return () => { if (texture) texture.dispose(); };
    }, [url]);

    if (!texture) return <meshBasicMaterial color="#333" />;
    return <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} side={THREE.DoubleSide} />;
}

// --- ART PLAQUE ---
function ArtPlaque({ mint, name, manualPrice }: { mint?: string, name?: string, manualPrice?: string }) {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [status, setStatus] = useState<string>("Checking...");
    const [priceText, setPriceText] = useState<string>("");
    const [listing, setListing] = useState<any>(null); 
    const [isBuying, setIsBuying] = useState(false);
    const [hovered, setHovered] = useState(false);

    // Helper to calculate total price including fees
    const calculateTotal = (baseSol: number, royaltyBps: number) => {
        const platformFee = 0.02; // 2% buffer/taker fee
        const royaltyPct = royaltyBps / 10000;
        return baseSol * (1 + royaltyPct + platformFee);
    };

    // 1. Initial Load
    useEffect(() => {
        if (!mint) { setStatus("Private Collection"); setPriceText(manualPrice || ""); return; }
        
        const fetchListing = async () => {
            try {
                // Force fresh fetch with timestamp
                const res = await fetch(`/api/me-proxy/listing?mint=${mint}&t=${Date.now()}`).catch(() => null);
                if (!res || !res.ok) throw new Error("API Error");
                
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const best = data[0]; 
                    const baseSol = best.price; 
                    
                    if (baseSol > 0) {
                        const totalSol = calculateTotal(baseSol, best.token?.sellerFeeBasisPoints || 0);
                        const baseLamports = best.priceInfo?.solPrice?.rawAmount || Math.floor(baseSol * 1e9);
                        const finalLamports = Math.floor(totalSol * 1e9);

                        setListing({ ...best, baseLamports, finalLamports, totalSol });
                        setPriceText(`${totalSol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`);
                        setStatus("LISTED");
                    } else { 
                        setStatus("NOT LISTED"); setPriceText(manualPrice || ""); setListing(null); 
                    }
                } else { 
                    setStatus("NOT LISTED"); setPriceText(manualPrice || ""); setListing(null); 
                }
            } catch (e) { 
                setStatus("NOT LISTED"); setPriceText(manualPrice || ""); 
            }
        };
        fetchListing();
    }, [mint, manualPrice]);

    // 2. Handle Buy (Refetches data to ensure price is fresh)
    const handleBuy = useCallback(async (e: any) => {
        e.stopPropagation();
        
        if (!publicKey) {
            toast.error("Please connect wallet first");
            return;
        }

        // Fallback if not listed locally
        if (status !== 'LISTED' || !listing) {
            if (mint) window.open(`https://magiceden.io/item-details/${mint}`, '_blank');
            return;
        }

        if (isBuying) return;
        setIsBuying(true);
        const toastId = toast.info("Verifying Listing...", { autoClose: false, closeOnClick: false });

        try {
            // A. RE-FETCH LISTING DATA (Crucial Step!)
            // We must verify the price hasn't changed since the page loaded
            const freshRes = await fetch(`/api/me-proxy/listing?mint=${mint}&t=${Date.now()}`);
            const freshData = await freshRes.json();
            
            let currentListing = listing;
            
            if (Array.isArray(freshData) && freshData.length > 0) {
                const freshBest = freshData[0];
                // Check if price changed
                if (freshBest.price !== listing.price) {
                    toast.dismiss(toastId);
                    toast.warn("Price updated! Refreshing...", { autoClose: 3000 });
                    
                    // Update local state
                    const totalSol = calculateTotal(freshBest.price, freshBest.token?.sellerFeeBasisPoints || 0);
                    setListing({
                        ...freshBest,
                        baseLamports: freshBest.priceInfo?.solPrice?.rawAmount || Math.floor(freshBest.price * 1e9),
                        finalLamports: Math.floor(totalSol * 1e9),
                        totalSol
                    });
                    setPriceText(`${totalSol.toLocaleString()} SOL`);
                    setIsBuying(false);
                    return; // Stop here, let user click again with new price
                }
                currentListing = { ...freshBest, baseLamports: freshBest.priceInfo?.solPrice?.rawAmount || Math.floor(freshBest.price * 1e9) };
            } else {
                throw new Error("Item is no longer listed.");
            }

            // B. CHECK BALANCE (With 0.02 SOL Buffer for Rent/Fees)
            const balance = await connection.getBalance(publicKey);
            const cost = Number(currentListing.finalLamports || listing.finalLamports);
            const buffer = 20_000_000; // 0.02 SOL
            
            if (balance < (cost + buffer)) {
                const shortfall = ((cost + buffer - balance) / 1e9).toFixed(4);
                throw new Error(`Insufficient SOL. Need ${shortfall} more for fees.`);
            }

            
            // C. BUILD TRANSACTION
            const query = new URLSearchParams({
                buyer: publicKey.toBase58(),
                seller: currentListing.seller,
                auctionHouseAddress: currentListing.auctionHouse,
                tokenMint: currentListing.tokenMint,
                tokenATA: currentListing.tokenAddress, 
                // FIX: Send price in SOL (0.05), NOT Lamports (50000000)
                price: currentListing.price.toString(), 
                sellerExpiry: (currentListing.expiry || "0").toString(), 
            });

            toast.update(toastId, { render: "Building Transaction..." });
            
            const res = await fetch(`/api/me-proxy/buy-now?${query.toString()}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "API Construction Failed");
            }

            const data = await res.json();
            if (!data.txSigned && !data.tx) throw new Error("No transaction data returned.");

            // D. DESERIALIZE & SIGN
            let txBuffer: Buffer;
            const txData = data.txSigned || data.tx; 
            if (typeof txData === 'string') txBuffer = Buffer.from(txData, 'base64');
            else if (txData?.data) txBuffer = Buffer.from(txData.data);
            else throw new Error("Invalid transaction format.");

            let transaction;
            try { transaction = VersionedTransaction.deserialize(txBuffer); } 
            catch (err) { transaction = Transaction.from(txBuffer); }

            toast.update(toastId, { render: "Please Sign in Wallet..." });
            
            const signature = await sendTransaction(transaction, connection, {
                skipPreflight: false, // Ensure simulation runs to catch errors early
                maxRetries: 3
            });
            
            // FIXED: Removed 'isLoading: true' to fix TS error
            toast.update(toastId, { render: "Confirming Transaction..." });
            
            await connection.confirmTransaction(signature, 'confirmed');
            
            toast.dismiss(toastId);
            toast.success("Purchase Successful!");
            setStatus("SOLD");
            setListing(null);

        } catch (err: any) {
            console.error("Buy Error:", err);
            toast.dismiss(toastId);
            
            // Nice error message
            const msg = err.message || "";
            if (msg.includes("0x1")) toast.error("Transaction Rejected");
            else if (msg.includes("Insufficient")) toast.error(msg);
            else {
                toast.info("Opening Magic Eden fallback...", { autoClose: 2000 });
                window.open(`https://magiceden.io/item-details/${mint}`, '_blank');
            }
        } finally { 
            setIsBuying(false); 
        }
    }, [publicKey, listing, connection, isBuying, mint, status, sendTransaction]);

    return (
        <group position={[6, -2, 0]}>
            <Box args={[3.5, 2.2, 0.2]} castShadow><meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.2} /></Box>
            <Box args={[3.6, 2.3, 0.1]} position={[0, 0, -0.05]}><meshStandardMaterial color="#DAA520" metalness={1} roughness={0.1} /></Box>
            
            <group position={[0, 0.3, 0.11]}>
                <Suspense fallback={null}>
                    <Text position={[0, 0.3, 0]} fontSize={0.25} color="#DAA520" font="/ROMEO.TTF" anchorX="center" maxWidth={3}>{name ? name.toUpperCase() : "UNTITLED"}</Text>
                    <Text position={[0, -0.1, 0]} fontSize={0.2} color={status === 'LISTED' ? '#4ade80' : '#9ca3af'} anchorX="center">{status}</Text>
                    {priceText && <Text position={[0, -0.4, 0]} fontSize={0.25} color="white" anchorX="center" font="/ROMEO.TTF">{priceText}</Text>}
                </Suspense>
            </group>

            {(status === 'LISTED' && listing) && (
                <group position={[0, -0.6, 0.15]} onClick={handleBuy} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
                    <Box args={[2.5, 0.5, 0.1]}>
                        <meshStandardMaterial color={isBuying ? "#555" : (hovered ? "#22c55e" : "#15803d")} emissive={hovered ? "#22c55e" : "#000"} emissiveIntensity={0.2} />
                    </Box>
                    <Suspense fallback={null}>
                        <Text position={[0, 0, 0.06]} fontSize={0.2} color="white" font="/ROMEO.TTF" anchorX="center" anchorY="middle">
                            {isBuying ? "PROCESSING..." : (publicKey ? "PURCHASE PIECE" : "CONNECT WALLET")}
                        </Text>
                    </Suspense>
                </group>
            )}
        </group>
    )
}

function InteractiveFrame({ url, label, price, link, position, rotation, isSold, variant, mint }: any) {
    const [hovered, setHover] = useState(false)
    const isPremium = variant === 'premium';
    const frameColor = isPremium ? "#DAA520" : (hovered ? "#ffd700" : "#111");
    const frameMetalness = isPremium ? 1.0 : 0.8;
    const frameRoughness = isPremium ? 0.1 : 0.2;

    // --- OPTIMIZATION: Check for Mobile ---
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <group position={position} rotation={rotation}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
            onClick={(e) => {
                if (isPremium) {
                    toast.info("Regeneration: The Beginning");
                }
            }}
        >
            <Box args={[9, 12, 0.5]} castShadow>
                <meshStandardMaterial color={frameColor} metalness={frameMetalness} roughness={frameRoughness} />
            </Box>
            <mesh position={[0, 0, 0.26]}>
                <planeGeometry args={[8, 11]} />
                <SafeImageMaterial url={cleanUrl(url)} opacity={isSold ? 0.5 : 1} />
            </mesh>
            {isSold && (
                <group position={[0, 0, 0.5]}>
                    <mesh rotation={[0, 0, Math.PI / 4]}>
                        <boxGeometry args={[8, 2, 0.1]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                    <Suspense fallback={null}>
                        <Text position={[0, 0, 0.1]} fontSize={1} color="white" font="/ROMEO.TTF" anchorX="center" anchorY="middle" rotation={[0, 0, Math.PI / 4]}>
                            SOLD OUT
                        </Text>
                    </Suspense>
                </group>
            )}
            
            {!isPremium && (
                <ArtPlaque mint={mint} name={label} manualPrice={price} />
            )}

            <group position={[0, -7, 0]}>
                <Box args={[8, 2, 0.2]}><meshStandardMaterial color="#000" /></Box>
                <Suspense fallback={null}>
                    <Text position={[0, 0.4, 0.11]} fontSize={0.6} color="white" font="/ROMEO.TTF" anchorX="center">{label?.toUpperCase()}</Text>
                    <Text position={[0, -0.4, 0.11]} fontSize={0.5} color={isSold ? "#ef4444" : "#DAA520"} anchorX="center">{isSold ? "SOLD" : price}</Text>
                </Suspense>
            </group>
        </group>
    )
}

export default function IRLArtGallery({ position, items = [] }: { position: [number, number, number], items?: any[] }) {
    const centerFeature = items.find(i => i.position === 'center');
    const midLeft = items.find(i => i.position === 'left-inner');
    const farLeft = items.find(i => i.position === 'left-outer');
    const midRight = items.find(i => i.position === 'right-inner');
    const farRight = items.find(i => i.position === 'right-outer');

    // --- OPTIMIZATION: Check for Mobile ---
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <group position={position}>
            {/* PHYSICS: Floor & Structure */}
            <RigidBody type="fixed" colliders="cuboid">
                {/* Visual Floor */}
                <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                    <boxGeometry args={[60, 40, 0.5]} />
                    {/* CONDITIONAL RENDERING: Standard on Mobile, Reflector on Desktop */}
                    {isMobile ? (
                        <meshStandardMaterial color="#f5f5f5" roughness={0.1} metalness={0.1} />
                    ) : (
                        <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.1} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#f5f5f5" metalness={0.1} mirror={0.7} />
                    )}
                </mesh>
                
                {/* Physics Floor (Aligned with top of visual floor at ~0.35) */}
                <CuboidCollider args={[30, 0.25, 20]} position={[0, 0.1, 0]} /> 

                <Box args={[62, 42, 0.4]} position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}><meshStandardMaterial color="#DAA520" metalness={1} roughness={0.1} /></Box>
                
                {/* Ceiling/Structure */}
                <Box args={[60, 40, 0.5]} position={[0, 18, 0]} rotation={[-Math.PI/2, 0, 0]}>
                    <meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0} metalness={0} thickness={0.5} transparent opacity={0.3} />
                </Box>
                
                {/* Borders */}
                <Box args={[62, 1, 1]} position={[0, 18, 20]}><meshStandardMaterial color="#DAA520" /></Box>
                <Box args={[62, 1, 1]} position={[0, 18, -20]}><meshStandardMaterial color="#DAA520" /></Box>
                <Box args={[1, 1, 42]} position={[30, 18, 0]}><meshStandardMaterial color="#DAA520" /></Box>
                <Box args={[1, 1, 42]} position={[-30, 18, 0]}><meshStandardMaterial color="#DAA520" /></Box>
            </RigidBody>

            {/* PHYSICS: Pillars */}
            <RigidBody type="fixed" colliders="hull">
                <Cylinder args={[1.5, 1.5, 18, 16]} position={[-28, 9, 18]}><meshStandardMaterial color="#fff" /></Cylinder>
                <Cylinder args={[1.5, 1.5, 18, 16]} position={[28, 9, 18]}><meshStandardMaterial color="#fff" /></Cylinder>
                <Cylinder args={[1.5, 1.5, 18, 16]} position={[-28, 9, -18]}><meshStandardMaterial color="#fff" /></Cylinder>
                <Cylinder args={[1.5, 1.5, 18, 16]} position={[28, 9, -18]}><meshStandardMaterial color="#fff" /></Cylinder>
            </RigidBody>

            <Suspense fallback={null}>
                <Text position={[0, 20, 20]} fontSize={3} color="#DAA520" font="/ROMEO.TTF" anchorX="center" rotation={[0, Math.PI, 0]}>NOBLE FINE ART</Text>
            </Suspense>

            {/* PHYSICS: Art Frames (Wrapped in RigidBody so they are solid) */}
            <RigidBody type="fixed" colliders="hull">
                <group position={[0, 8.5, -18]}>
                    <InteractiveFrame url="/Regeneration.jpg" label="REGENERATION" price="Permanent Collection" variant="premium" position={[0, 0, 0]} rotation={[0, Math.PI, 0]} />
                </group>
                {centerFeature && <InteractiveFrame {...centerFeature} url={centerFeature.image} label={centerFeature.name} mint={centerFeature.nftMint} position={[0, 8.5, 25]} rotation={[0, Math.PI, 0]} />}
                {midLeft && <InteractiveFrame {...midLeft} url={midLeft.image} label={midLeft.name} mint={midLeft.nftMint} position={[-15, 8.5, 0]} rotation={[0, Math.PI - 0.3, 0]} />}
                {midRight && <InteractiveFrame {...midRight} url={midRight.image} label={midRight.name} mint={midRight.nftMint} position={[15, 8.5, 0]} rotation={[0, Math.PI + 0.3, 0]} />}
                {farLeft && <InteractiveFrame {...farLeft} url={farLeft.image} label={farLeft.name} mint={farLeft.nftMint} position={[-16, 8.5, 22]} rotation={[0, Math.PI - 0.7, 0]} />}
                {farRight && <InteractiveFrame {...farRight} url={farRight.image} label={farRight.name} mint={farRight.nftMint} position={[16, 8.5, 22]} rotation={[0, Math.PI + 0.7, 0]} />}
            </RigidBody>

            <pointLight position={[0, 15, 0]} intensity={80} distance={50} color="#fffaf0" />
            <spotLight position={[0, 20, 20]} target-position={[0, 5, 0]} intensity={150} angle={0.6} penumbra={0.5} castShadow />
        </group>
    )
}