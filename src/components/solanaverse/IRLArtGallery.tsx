"use client"
import React, { Suspense, useState, useEffect, useCallback } from 'react'
import { Box, Text, MeshReflectorMaterial, Cylinder } from '@react-three/drei'
import * as THREE from 'three'
import { VersionedTransaction, Transaction } from '@solana/web3.js' 
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-toastify'; 
import { RigidBody, CuboidCollider } from '@react-three/rapier' // <--- IMPORT PHYSICS

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

    useEffect(() => {
        if (!mint) { setStatus("Private Collection"); setPriceText(manualPrice || ""); return; }
        const checkListing = async () => {
            try {
                const res = await fetch(`/api/me-proxy/listing?mint=${mint}&t=${Date.now()}`);
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const bestListing = data[0]; 
                    let baseSol = bestListing.price; 
                    let baseLamports = bestListing.priceInfo?.solPrice?.rawAmount;
                    if (!baseLamports && baseSol > 0) baseLamports = Math.floor(baseSol * 1_000_000_000);
                    const royaltyBps = bestListing.token?.sellerFeeBasisPoints || 0;
                    const royaltyPct = royaltyBps / 10000; 
                    const platformFeePct = 0.02; 
                    const totalMultiplier = 1 + royaltyPct + platformFeePct;
                    const totalSol = baseSol * totalMultiplier; 
                    const totalLamports = Math.floor(totalSol * 1_000_000_000);
                    if (baseSol > 0) {
                        setListing({ ...bestListing, baseLamports, finalLamports: totalLamports, finalSol: totalSol });
                        setPriceText(`${totalSol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`);
                        setStatus("LISTED");
                    } else { setStatus("NOT LISTED"); setPriceText(manualPrice || ""); setListing(null); }
                } else { setStatus("NOT LISTED"); setPriceText(manualPrice || ""); setListing(null); }
            } catch (e) { console.error("Listing Check Error:", e); setStatus("Unknown"); setPriceText(manualPrice || ""); }
        };
        checkListing();
    }, [mint, manualPrice]);

    const handleBuy = useCallback(async (e: any) => {
        e.stopPropagation();
        if (!publicKey || !listing || isBuying) return;
        setIsBuying(true);
        const toastId = toast.info("Processing Purchase...", { autoClose: false, closeOnClick: false });
        try {
            const balance = await connection.getBalance(publicKey);
            const cost = Number(listing.finalLamports);
            if (balance < (cost + 5000000)) throw new Error(`Insufficient SOL.`);
            let sellerExpiry = listing.expiry;
            if (!sellerExpiry || sellerExpiry === -1 || sellerExpiry === "-1") sellerExpiry = "0";
            const query = new URLSearchParams({
                buyer: publicKey.toBase58(),
                seller: listing.seller,
                auctionHouseAddress: listing.auctionHouse,
                tokenMint: listing.tokenMint,
                tokenATA: listing.tokenAddress, 
                price: listing.baseLamports.toString(), 
                sellerExpiry: sellerExpiry.toString(), 
            });
            const res = await fetch(`/api/me-proxy/buy-now?${query.toString()}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (!data.txSigned && !data.tx) throw new Error("No transaction returned.");
            let txBuffer: Buffer;
            const txData = data.txSigned || data.tx; 
            if (typeof txData === 'string') txBuffer = Buffer.from(txData, 'base64');
            else if (txData?.data) txBuffer = Buffer.from(txData.data);
            else throw new Error("Invalid transaction format.");
            let transaction;
            try { transaction = VersionedTransaction.deserialize(txBuffer); } 
            catch (err) { try { transaction = Transaction.from(txBuffer); } catch (legacyErr) { throw new Error("Failed to deserialize."); } }
            const signature = await sendTransaction(transaction, connection);
            toast.dismiss(toastId);
            const confirmId = toast.info("Transaction Sent! Confirming...", { autoClose: false, closeOnClick: false });
            await connection.confirmTransaction(signature, 'confirmed');
            toast.dismiss(confirmId);
            toast.success("Purchase Successful!");
            setStatus("SOLD");
            setListing(null);
        } catch (err: any) {
            console.error("Buy Failed:", err);
            toast.dismiss(toastId);
            toast.error(`Buy Failed: ${err.message}`);
        } finally { setIsBuying(false); }
    }, [publicKey, listing, connection, isBuying]);

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
            {status === 'LISTED' && listing && (
                <group position={[0, -0.6, 0.15]} onClick={handleBuy} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
                    <Box args={[2.5, 0.5, 0.1]}><meshStandardMaterial color={isBuying ? "#555" : (hovered ? "#22c55e" : "#15803d")} emissive={hovered ? "#22c55e" : "#000"} emissiveIntensity={0.2} /></Box>
                    <Suspense fallback={null}><Text position={[0, 0, 0.06]} fontSize={0.2} color="white" font="/ROMEO.TTF" anchorX="center" anchorY="middle">{isBuying ? "PROCESSING..." : (publicKey ? "PURCHASE PIECE" : "CONNECT WALLET")}</Text></Suspense>
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

    return (
        <group position={position}>
            {/* PHYSICS: Floor & Structure */}
            <RigidBody type="fixed" colliders="cuboid">
                {/* Visual Floor */}
                <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                    <boxGeometry args={[60, 40, 0.5]} />
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.1} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#f5f5f5" metalness={0.1} mirror={0.7} />
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