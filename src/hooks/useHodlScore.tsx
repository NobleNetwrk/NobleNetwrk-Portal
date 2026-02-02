import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';

// --- IMPORT HASHLISTS ---
import geneticsHashlist from '@/data/noble_genetics_hashlist.json'
import extractsHashlist from '@/data/noble_extracts_hashlist.json'
import namasteHashlist from '@/data/namaste_hashlist.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'
import k9Hashlist from '@/data/solanak9s_hashlist.json'
import senseiHashlist from '@/data/sensei_hashlist.json'
import tsoHashlist from '@/data/tso_hashlist.json'
import ttcHashlist from '@/data/TimeTravelingChimps_hashlist.json'
import p1Hashlist from '@/data/Player1_hashlist.json'
import ggHashlist from '@/data/GalacticGecko_hashlist.json'

// Create Sets for O(1) Lookup
const HASHLISTS = {
  genetics: new Set(geneticsHashlist),
  extracts: new Set(extractsHashlist),
  namaste: new Set(namasteHashlist),
  d3fenders: new Set(d3fendersHashlist),
  stonedApeCrew: new Set(sacHashlist),
  solanaK9s: new Set(k9Hashlist),
  sensei: new Set(senseiHashlist),
  tso: new Set(tsoHashlist),
  timeTravelingChimps: new Set(ttcHashlist),
  player1: new Set(p1Hashlist),
  galacticGeckos: new Set(ggHashlist),
}

export interface HodlAsset {
  mint: string;
  name: string;
  image: string;
  owner: string;
  daysHeld: number;
}

export interface HodlData {
  totalScore: number;
  details: HodlAsset[];
  lastUpdated?: string;
}

export interface CollectionConfig {
  key: string;
  label: string;
  icon: string;
  color: string;
  action?: string;
  actionLabel?: string;
  matcher?: (name: string) => boolean; 
}

export const ASSET_CONFIG: CollectionConfig[] = [
  { key: 'genetics', label: 'Noble Genetics', icon: '/noble-genetics-icon.png', color: 'purple' },
  { key: 'extracts', label: 'Noble Extracts', icon: '/noble-extracts-icon.png', color: 'red' },
  { key: 'namaste', label: 'Namaste', icon: '/namaste-icon.png', color: 'yellow' },
  { key: 'solanaK9s', label: 'Solana K9', icon: '/solana-k9s-icon.png', color: 'blue', action: 'K9Impound', actionLabel: 'Impound' },
  { key: 'sensei', label: 'Sensei Panda', icon: '/sensei-icon.png', color: 'emerald', action: 'PandaLoveLevel', actionLabel: 'Love Level' },
  { key: 'timeTravelingChimps', label: 'Time Traveling Chimps', icon: '/TimeTravelingChimps-icon.png', color: 'teal' },
  { key: 'player1', label: 'Player 1', icon: '/Player1-icon.png', color: 'pink' },
  { key: 'tso', label: 'Smoke Out', icon: '/tso-icon.png', color: 'orange' },
  { key: 'd3fenders', label: 'D3fenders', icon: '/d3fenders-icon.png', color: 'indigo' },
  { key: 'stonedApeCrew', label: 'Stoned Ape', icon: '/sac-icon.png', color: 'green' },
  { key: 'galacticGeckos', label: 'Galactic Geckos', icon: '/immortal-gecko-icon.png', color: 'cyan' },
];

export function useHodlScore(userId: string | null) {
  const [data, setData] = useState<HodlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const CACHE_KEY = userId ? `noble_hodl_details_${userId}` : null;

  // 1. Initial Fetch
  useEffect(() => {
    if (!userId || !CACHE_KEY) return;
    
    const fetchSaved = async () => {
      setLoading(true);
      try {
        const cachedDetails = localStorage.getItem(CACHE_KEY);
        let localDetails: HodlAsset[] = [];
        if (cachedDetails) {
            try { localDetails = JSON.parse(cachedDetails); } catch(e) {}
        }

        const res = await fetch(`/api/hodl-score?userId=${userId}`);
        const result = await res.json();
        
        setData({
            totalScore: result.totalScore || 0,
            details: localDetails,
            lastUpdated: result.lastUpdated
        });
      } catch (e) {
        console.error("Failed to load saved HODL score", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [userId, CACHE_KEY]);

  // 2. Refresh Action
  const refreshScore = useCallback(async (wallets: string[]) => {
    if (!userId || wallets.length === 0 || !CACHE_KEY) return;
    
    setRefreshing(true);
    try {
      const res = await fetch('/api/hodl-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets, userId })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");
      
      setData(result);
      localStorage.setItem(CACHE_KEY, JSON.stringify(result.details));
      
      toast.success(`HODL Score Updated!`);
      return result;
    } catch (err: any) {
      toast.error("Update failed");
    } finally {
      setRefreshing(false);
    }
  }, [userId, CACHE_KEY]);

  // 3. Grouping Logic (Memoized)
  const groupedAssets = useMemo(() => {
    if (!data || !data.details) return {};
    
    const groups: Record<string, HodlAsset[]> = {};
    ASSET_CONFIG.forEach(c => groups[c.key] = []);
    groups['other'] = [];

    data.details.forEach(asset => {
        let matched = false;
        // Priority checks via Hashlists
        if (HASHLISTS.genetics.has(asset.mint)) { groups['genetics'].push(asset); matched = true; }
        else if (HASHLISTS.extracts.has(asset.mint)) { groups['extracts'].push(asset); matched = true; }
        else if (HASHLISTS.namaste.has(asset.mint)) { groups['namaste'].push(asset); matched = true; }
        else if (HASHLISTS.d3fenders.has(asset.mint)) { groups['d3fenders'].push(asset); matched = true; }
        else if (HASHLISTS.stonedApeCrew.has(asset.mint)) { groups['stonedApeCrew'].push(asset); matched = true; }
        else if (HASHLISTS.solanaK9s.has(asset.mint)) { groups['solanaK9s'].push(asset); matched = true; }
        else if (HASHLISTS.sensei.has(asset.mint)) { groups['sensei'].push(asset); matched = true; }
        else if (HASHLISTS.tso.has(asset.mint)) { groups['tso'].push(asset); matched = true; }
        else if (HASHLISTS.timeTravelingChimps.has(asset.mint)) { groups['timeTravelingChimps'].push(asset); matched = true; }
        else if (HASHLISTS.player1.has(asset.mint)) { groups['player1'].push(asset); matched = true; }
        else if (HASHLISTS.galacticGeckos.has(asset.mint)) { groups['galacticGeckos'].push(asset); matched = true; }

        if (!matched) groups['other'].push(asset);
    });
    return groups;
  }, [data]);

  // 4. Sorted Configs (Descending by HODL Score)
  const sortedConfigs = useMemo(() => {
    // If no data, return default static order
    if (!groupedAssets || Object.keys(groupedAssets).length === 0) return ASSET_CONFIG;

    // Clone and Sort
    return [...ASSET_CONFIG].sort((a, b) => {
        // Sum daysHeld for all assets in the group
        const scoreA = (groupedAssets[a.key] || []).reduce((sum, item) => sum + item.daysHeld, 0);
        const scoreB = (groupedAssets[b.key] || []).reduce((sum, item) => sum + item.daysHeld, 0);
        return scoreB - scoreA; // Descending
    });
  }, [groupedAssets]);

  // 5. Helper function for Portal to get raw grouping map
  const getBreakdown = useCallback(() => groupedAssets, [groupedAssets]);

  return {
    hodlData: data,
    loading,
    refreshing,
    refreshScore,
    getBreakdown,
    configs: sortedConfigs // Portal iterates this, so tiles will reorder automatically!
  };
}