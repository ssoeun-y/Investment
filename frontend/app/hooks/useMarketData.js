import { useState, useEffect } from 'react';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

export function useMarketData() {
    const [cryptoData, setCryptoData] = useState([]);
    const [fearGreed, setFearGreed]   = useState(null);
    const [kospiData, setKospiData]   = useState(null);
    const [kosdaqData, setKosdaqData] = useState(null);
    const [stockData, setStockData]   = useState([]);

    const fetchAllMarketData = async () => {
        const url = `${serverUrl}/api/market/all`;
        console.log(`[MARKET/ALL] 요청 → ${url}`);
        console.time('[MARKET/ALL] 응답시간');
        try {
            const r = await fetch(url, { credentials: 'include' });
            console.timeEnd('[MARKET/ALL] 응답시간');
            console.log(`[MARKET/ALL] status: ${r.status}`);
            if (!r.ok) throw new Error('status: ' + r.status);
            const data = await r.json();
            console.log('[MARKET/ALL] 전체 응답:', data.result);
            return data.result;
        } catch (e) {
            console.error('[MARKET/ALL] 실패:', e.message);
            return null;
        }
    };

    const fetchFearGreed = async () => {
        const url = 'https://api.alternative.me/fng/?limit=1';
        console.log(`[FEAR/GREED] 요청 → ${url}`);
        try {
            const r = await fetch(url);
            const d = await r.json();
            console.log('[FEAR/GREED] 응답:', d.data[0]);
            return d.data[0];
        } catch (e) {
            console.warn('[FEAR/GREED] 실패, 기본값 사용:', e.message);
            return { value: '62', value_classification: 'Greed' };
        }
    };

    const fetchCrossMarketHistory = async (days = 1) => {
        const url = `${serverUrl}/api/market/history?days=${days}`;
        console.log(`[HISTORY] 요청 → ${url}`);
        console.time(`[HISTORY] days=${days} 응답시간`);
        try {
            const r = await fetch(url);
            console.timeEnd(`[HISTORY] days=${days} 응답시간`);
            console.log(`[HISTORY] status: ${r.status}`);
            if (!r.ok) throw new Error();
            const data = await r.json();
            const { btc, nasdaq, kospi } = data.result;
            console.log(`[HISTORY] btc: ${btc?.length}건, nasdaq: ${nasdaq?.length}건, kospi: ${kospi?.length}건`);
            return { btc, nasdaq, kospi };
        } catch (e) {
            console.warn('[HISTORY] 실패, 더미 데이터 사용:', e.message);
            const now = Date.now();
            return {
                btc:    Array.from({ length: 24 }, (_, i) => [now - (23-i)*3600000, 95000000 + Math.sin(i*0.5)*2000000]),
                nasdaq: Array.from({ length: 24 }, (_, i) => [now - (23-i)*3600000, 18000 + Math.sin(i*0.3)*200]),
                kospi:  Array.from({ length: 24 }, (_, i) => [now - (23-i)*3600000, 2700  + Math.sin(i*0.4)*30]),
            };
        }
    };

    useEffect(() => {
        const init = async () => {
            console.group('[INIT] 마켓 데이터 전체 갱신');
            const market = await fetchAllMarketData();
            if (market) {
                const cryptos = (market.crypto || []).map(c => ({
                    symbol: c.symbol?.toUpperCase(),
                    name: c.name || c.symbol,
                    current_price: c.price,
                    price_change_percentage_24h: c.change24h,
                    total_volume: c.volume,
                }));
                console.log('[MARKET] 코인 목록:', cryptos.map(c => c.symbol));
                console.log('[MARKET] 주식 목록:', (market.stocks || []).map(s => s.symbol));
                console.log('[MARKET] 한국 지수:', market.krIndex);
                setCryptoData(cryptos);
                setStockData(market.stocks || []);
                setKospiData(market.krIndex?.[0]
                    ? { label: market.krIndex[0].name, price: market.krIndex[0].price, change: market.krIndex[0].change }
                    : null);
                setKosdaqData(market.krIndex?.[1]
                    ? { label: market.krIndex[1].name, price: market.krIndex[1].price, change: market.krIndex[1].change }
                    : null);
            }
            const fg = await fetchFearGreed();
            if (fg) setFearGreed(fg);
            console.groupEnd();
        };

        init();
        const interval = setInterval(init, 60000);
        return () => clearInterval(interval);
    }, []);

    return { cryptoData, fearGreed, kospiData, kosdaqData, stockData, fetchCrossMarketHistory };
}