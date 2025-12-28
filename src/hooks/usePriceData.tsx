// usePriceData.tsx (Revised for robustness)

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

export interface PriceData {
  sol: number | null;
  ntwrk: number | null;
}

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const NTWRK_MINT_ADDRESS = 'NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS';
const JUP_PRICE_API = 'https://lite-api.jup.ag/price/v3';

export function usePriceData() {
  const [priceData, setPriceData] = useState<PriceData>({ sol: null, ntwrk: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPriceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(JUP_PRICE_API, {
        params: {
          ids: `${SOL_MINT_ADDRESS},${NTWRK_MINT_ADDRESS}`,
        },
      });

      // Safely access nested properties
      const data = response.data?.data; 

      if (!data) {
        // Handle cases where the API returns an empty or unexpected response
        throw new Error('API response data is undefined or empty.');
      }

      // Use optional chaining for safe access to prices
      const solPrice = data[SOL_MINT_ADDRESS]?.usdPrice ?? null;
      const ntwrkPrice = data[NTWRK_MINT_ADDRESS]?.usdPrice ?? null;

      setPriceData({ sol: solPrice, ntwrk: ntwrkPrice });

    } catch (err) {
      console.error('Error fetching price data:', err);
      toast.error('Failed to fetch token prices.');
      setError('Failed to fetch prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPriceData();
    const interval = setInterval(fetchPriceData, 60000); 
    return () => clearInterval(interval);
  }, [fetchPriceData]);

  return { priceData, loading, error, refetch: fetchPriceData };
}