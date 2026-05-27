'use client';
import { useState, useEffect, useMemo } from 'react';

const DEFAULT_SETTINGS = {
  priceAlert: true,
  decouplingAlert: true,
  fearGreedAlert: false,
  threshold: 5,
};

const STORAGE_KEY = 'alertSettings';

function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch {}
  }, []);

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return { settings, update };
}

// 실제 지표 계산 — 시장 데이터에서 알림 조건 도출
function computeActiveAlerts(settings, stockData, krStockData, cryptoData, fearGreed) {
  const alerts = [];
  const threshold = settings.threshold ?? 5;

  // ── 급등/급락 알림
  if (settings.priceAlert) {
    const allItems = [
      ...(cryptoData  || []).map(c => ({ symbol: c.symbol, change: c.price_change_percentage_24h, type: '코인' })),
      ...(stockData   || []).map(s => ({ symbol: s.symbol, change: s.change, type: '미국주식' })),
      ...(krStockData || []).map(s => ({ symbol: s.symbol, change: s.change, type: '한국주식' })),
    ];
    allItems.forEach(item => {
      if (item.change == null) return;
      const abs = Math.abs(item.change);
      if (abs >= threshold) {
        alerts.push({
          type: item.change > 0 ? 'green' : 'red',
          label: item.change > 0 ? `급등 +${item.change.toFixed(1)}%` : `급락 ${item.change.toFixed(1)}%`,
          msg: `${item.symbol} (${item.type}) — 24h ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}% (임계값 ±${threshold}% 초과)`,
        });
      }
    });
  }

  // ── 디커플링 신호 알림
  if (settings.decouplingAlert) {
    const btcChg = (cryptoData || []).find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? null;
    const allStockChgs = [
      ...(stockData   || []).map(s => s.change ?? 0),
      ...(krStockData || []).map(s => s.change ?? 0),
    ];
    if (btcChg !== null && allStockChgs.length) {
      const stockAvg = allStockChgs.reduce((a, b) => a + b, 0) / allStockChgs.length;
      const diff = Math.abs(btcChg - stockAvg);
      const btcDir = btcChg > 0 ? 1 : -1;
      const stDir  = stockAvg > 0 ? 1 : -1;
      if (btcDir !== stDir && diff > 3) {
        alerts.push({
          type: 'yellow',
          label: '강한 디커플링',
          msg: `BTC ${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}% vs 주식평균 ${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(1)}% — ${diff.toFixed(1)}%p 방향 역전`,
        });
      } else if (btcDir === stDir && diff > 5) {
        alerts.push({
          type: 'yellow',
          label: '약한 분리',
          msg: `방향 동일하나 강도 격차 — BTC ${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}% vs 주식 ${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(1)}%`,
        });
      }
    }
  }

  // ── 공포/탐욕 알림
  if (settings.fearGreedAlert && fearGreed) {
    const fgVal = Number(fearGreed.value);
    if (fgVal <= 35) {
      alerts.push({
        type: 'green',
        label: `공포 구간 (${fgVal})`,
        msg: `공포/탐욕 지수 ${fgVal} — "${fearGreed.value_classification}" 저가 매수 타이밍 가능성`,
      });
    } else if (fgVal >= 65) {
      alerts.push({
        type: 'red',
        label: `탐욕 구간 (${fgVal})`,
        msg: `공포/탐욕 지수 ${fgVal} — "${fearGreed.value_classification}" 차익실현 고려 구간`,
      });
    }
  }

  return alerts;
}

const DOT_COLOR = { red: '#f87171', yellow: '#f5c842', green: '#4ade80' };

export default function AlertSettings({ stockData, krStockData, cryptoData, fearGreed }) {
  const { settings, update } = useSettings();

  const activeAlerts = useMemo(
    () => computeActiveAlerts(settings, stockData, krStockData, cryptoData, fearGreed),
    [settings, stockData, krStockData, cryptoData, fearGreed]
  );

  const TOGGLE_ROWS = [
    { key: 'priceAlert',      label: '급등/급락 알림',     desc: `종목 24h 변동률 ±${settings.threshold}% 초과 시 표시` },
    { key: 'decouplingAlert', label: '디커플링 신호 알림', desc: 'BTC↔주식 방향 역전 또는 5%p 이상 격차 시 표시' },
    { key: 'fearGreedAlert',  label: '공포/탐욕 알림',     desc: '지수 35 이하(공포) 또는 65 이상(탐욕) 진입 시 표시' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 토글 설정 */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {TOGGLE_ROWS.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < TOGGLE_ROWS.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{row.desc}</div>
            </div>
            <div
              onClick={() => update(row.key, !settings[row.key])}
              style={{
                width: 38, height: 22, borderRadius: 11, cursor: 'pointer',
                background: settings[row.key] ? 'var(--accent)' : 'var(--bg3)',
                border: '1px solid var(--border)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: settings[row.key] ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: settings[row.key] ? '#000' : 'var(--muted)',
                transition: 'left 0.2s',
              }} />
            </div>
          </div>
        ))}

        {/* 임계값 슬라이더 */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            급등/급락 임계값: <span style={{ color: 'var(--accent)', fontFamily: "'DM Mono',monospace" }}>±{settings.threshold}%</span>
          </div>
          <input
            type="range" min={1} max={20} step={1}
            value={settings.threshold}
            onChange={e => update('threshold', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            <span>1%</span><span>20%</span>
          </div>
        </div>
      </div>

      {/* 실시간 알림 목록 */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          현재 발생 중인 알림 ({activeAlerts.length})
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--muted2)', fontSize: 12,
          }}>
            설정된 조건에 해당하는 알림이 없습니다
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeAlerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                background: `${DOT_COLOR[alert.type]}10`,
                border: `1px solid ${DOT_COLOR[alert.type]}30`,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: DOT_COLOR[alert.type],
                  flexShrink: 0, marginTop: 5, display: 'inline-block',
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {alert.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.5 }}>{alert.msg}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
