'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SECTION_ORDER = ['coin', 'kr', 'us'];
const SECTION_LABEL = { coin: '코인', kr: '한국 주식', us: '미국 주식' };

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function buildLocalResults(query, stockData, krStockData, cryptoData) {
  const q = query.toLowerCase();
  const coins = (cryptoData || [])
    .filter(c => c.symbol?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .map(c => ({ symbol: c.symbol, name: c.name, type: 'coin', change: c.price_change_percentage_24h }));

  const kr = (krStockData || [])
    .filter(s => s.symbol?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .map(s => ({ symbol: s.symbol, name: s.name, type: 'kr', change: s.change }));

  const us = (stockData || [])
    .filter(s => s.symbol?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .map(s => ({ symbol: s.symbol, name: s.name, type: 'us', change: s.change }));

  return { coin: coins, kr, us };
}

export default function SearchDropdown({ stockData, krStockData, cryptoData }) {
  const [query, setQuery]           = useState('');
  const [open, setOpen]             = useState(false);
  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [apiAvailable, setApiAvail] = useState(true);
  const containerRef                = useRef(null);
  const router                      = useRouter();
  const debouncedQuery              = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      if (apiAvailable) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
            credentials: 'include',
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) throw new Error('not ok');
          const data = await res.json();
          if (!cancelled) {
            setResults(data.result ?? data);
            setLoading(false);
          }
          return;
        } catch {
          if (!cancelled) setApiAvail(false);
        }
      }
      // local fallback
      if (!cancelled) {
        setResults(buildLocalResults(debouncedQuery, stockData, krStockData, cryptoData));
        setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, apiAvailable, stockData, krStockData, cryptoData]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((symbol, type) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    router.push(`/search/${encodeURIComponent(symbol)}?type=${type}`);
  }, [router]);

  const hasResults = results && SECTION_ORDER.some(k => results[k]?.length);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        className="search-box"
        style={{ cursor: 'text' }}
        onClick={() => setOpen(true)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="종목 검색..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 12, width: 120,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {open && query.trim() && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 280, background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, zIndex: 9999, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {loading && (
            <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted2)' }}>
              검색 중...
            </div>
          )}

          {!loading && !hasResults && results !== null && (
            <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted2)' }}>
              검색 결과 없음
            </div>
          )}

          {!loading && hasResults && SECTION_ORDER.map(sectionKey => {
            const items = results[sectionKey];
            if (!items?.length) return null;
            return (
              <div key={sectionKey}>
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 10, fontWeight: 600, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {SECTION_LABEL[sectionKey]}
                </div>
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(item.symbol, item.type)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 16px', cursor: 'pointer',
                      borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>
                        {item.symbol}
                      </span>
                      {item.name && item.name !== item.symbol && (
                        <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 8 }}>
                          {item.name}
                        </span>
                      )}
                    </div>
                    {item.change != null && (
                      <span style={{
                        fontSize: 11, fontFamily: "'DM Mono',monospace",
                        color: item.change >= 0 ? '#4ade80' : '#f87171',
                      }}>
                        {item.change >= 0 ? '+' : ''}{Number(item.change).toFixed(2)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
