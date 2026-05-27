'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Watchlist({ stockData, krStockData, cryptoData }) {
  const [items, setItems]     = useState(null);
  const [loading, setLoading] = useState(true);
  const router                = useRouter();

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      // TODO: replace with GET /api/watchlist when endpoint is available
      const res = await fetch('/api/watchlist', { credentials: 'include' });
      if (!res.ok) throw new Error('no api');
      const data = await res.json();
      setItems(data.result ?? data ?? []);
    } catch {
      // TODO: sync with /api/watchlist when endpoint is available
      try {
        const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
        setItems(saved);
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWatchlist(); }, []);

  const removeItem = (symbol, type) => {
    // TODO: call DELETE /api/watchlist when endpoint is available
    try {
      const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
      const next  = saved.filter(w => !(w.symbol === symbol && w.type === type));
      localStorage.setItem('watchlist', JSON.stringify(next));
      setItems(next);
    } catch {}
  };

  const getLiveData = (symbol, type) => {
    if (type === 'coin')   return cryptoData?.find(c => c.symbol === symbol);
    if (type === 'kr')     return krStockData?.find(s => s.symbol === symbol);
    return stockData?.find(s => s.symbol === symbol);
  };

  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 13 }}>로딩 중...</div>;
  }

  if (!items?.length) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 200, gap: 10, background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 12, color: 'var(--muted2)', fontSize: 13,
      }}>
        <span style={{ fontSize: 24 }}>♡</span>
        <span>관심 종목이 없습니다</span>
        <span style={{ fontSize: 11 }}>종목 검색 후 ♡ 버튼으로 추가하세요</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, idx) => {
        const live    = getLiveData(item.symbol, item.type);
        const price   = live ? (item.type === 'coin' ? live.current_price : live.price) : null;
        const change  = live ? (item.type === 'coin' ? live.price_change_percentage_24h : live.change) : null;
        const typeLabel = item.type === 'coin' ? '코인' : item.type === 'kr' ? '한국주식' : '미국주식';

        return (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
            onClick={() => router.push(`/search/${item.symbol}?type=${item.type}`)}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>
                  {item.symbol}
                </span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--bg3)', color: 'var(--muted2)' }}>
                  {typeLabel}
                </span>
              </div>
              {item.addedAt && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  추가: {new Date(item.addedAt).toLocaleDateString('ko-KR')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {price != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>
                    {price >= 10000
                      ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : `$${price.toFixed(2)}`}
                  </div>
                  {change != null && (
                    <div style={{ fontSize: 11, color: change >= 0 ? '#4ade80' : '#f87171', fontFamily: "'DM Mono',monospace" }}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  )}
                </div>
              )}
              {price == null && (
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>실시간 데이터 없음</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); removeItem(item.symbol, item.type); }}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--muted2)',
                  cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 4,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
                title="관심 해제"
              >
                ♥
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
