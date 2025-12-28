// src/hooks/useVaultData.ts

import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react'
import { useCallback, useEffect, useState } from 'react';
import base58 from 'bs58';
import { toast } from 'react-toastify'

interface Holdings {
    genetics: number;
    extracts: number;
    namaste: number;
    solanaK9s: number;
    sensei: number;
    tso: number;
    d3fenders: number;
    stonedApeCrew: number;
    immortalGecko: number;
}

interface VaultData {
    solBalance: number;
    solPrice: number | null;
    ntwrkBalance: number;
    ntwrkPrice: number | null;
    holdings: Holdings;
}

const VAULT_DATA_API = '/api/vault/data';
const VERIFY_WALLET_API = '/api/verify-wallet'; // Still keep this separate for security

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.') as Error & { info: any, status: number };
        error.info = await res.json();
        error.status = res.status;
        throw error;
    }
    const { data } = await res.json();
    return data;
};

export const useVaultData = () => {
    const { publicKey, connected, disconnect, signMessage } = useWallet();
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const dataUrl = connected && isVerified && publicKey ? `${VAULT_DATA_API}?publicKey=${publicKey.toBase58()}` : null;
    
    const { data, error, isLoading, mutate } = useSWR<VaultData>(dataUrl, fetcher, {
        revalidateOnFocus: false,
    });

    const verifyWallet = useCallback(async () => {
        if (!publicKey || !signMessage) {
            toast.error('Wallet not connected or does not support signing');
            return;
        }

        setIsVerifying(true);
        try {
            const message = `Sign this message to authenticate with NobleNetwrk Vault.`;
            const encodedMessage = new TextEncoder().encode(message);
            const signature = await signMessage(encodedMessage);

            const response = await fetch(VERIFY_WALLET_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    publicKey: publicKey.toBase58(),
                    message: message,
                    signature: base58.encode(signature),
                }),
            });

            if (!response.ok) {
                throw new Error('Verification failed');
            }

            toast.success('Wallet verified!');
            setIsVerified(true);
            localStorage.setItem('verifiedWallet', publicKey.toBase58());
            // Manually trigger a re-fetch of the data after verification
            mutate();

        } catch (err) {
            console.error('Signing or verification failed:', err);
            toast.error('Wallet verification failed');
            disconnect();
        } finally {
            setIsVerifying(false);
        }
    }, [publicKey, signMessage, disconnect, mutate]);

    useEffect(() => {
        const storedWallet = localStorage.getItem('verifiedWallet');
        const walletIsVerified = connected && storedWallet === publicKey?.toBase58();
        setIsVerified(walletIsVerified);
    }, [connected, publicKey]);

    return {
        vaultData: data,
        loading: isLoading,
        error,
        refetch: mutate,
        isVerified,
        isVerifying,
        verifyWallet,
    };
};