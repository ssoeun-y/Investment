'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CAT_LABEL = { coin:'코인', kr_stock:'국내주식', us_stock:'해외주식', general:'전체' };

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', { month:'numeric', day:'numeric', year:'numeric' });
}

export default function MyPosts() {
  const [posts, setPosts]     = useState(null);
  const [loading, setLoading] = useState(true);
  const router                = useRouter();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/posts/my', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPosts(data.result ?? []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (postId, e) => {
    e.stopPropagation();
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch {}
  };

  if (loading) {
    return <div style={{ padding:'32px 0', textAlign:'center', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  if (!posts?.length) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:180, gap:8, background:'var(--bg2)', border:'1px solid var(--border)',
        borderRadius:12, color:'var(--muted2)', fontSize:13,
      }}>
        <span style={{ fontSize:24 }}>📝</span>
        <span>작성한 글이 없습니다</span>
        <a href="/community" style={{ fontSize:12, color:'var(--accent)', textDecoration:'none' }}>토론 게시판 가기</a>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {posts.map(post => (
        <div
          key={post.id}
          onClick={() => router.push(`/community?id=${post.id}`)}
          style={{
            display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12,
            padding:'12px 16px', background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:10, cursor:'pointer', transition:'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
        >
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
              <span style={{
                fontSize:9, padding:'2px 7px', borderRadius:3,
                background:'var(--bg3)', color:'var(--muted2)', fontWeight:600,
              }}>
                {CAT_LABEL[post.category] ?? post.category}
              </span>
              <span style={{ fontSize:10, color:'var(--muted)' }}>{fmtDate(post.createdAt)}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {post.title}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:5, fontSize:11, color:'var(--muted2)' }}>
              <span>♥ {post.likeCount ?? 0}</span>
              <span>💬 {post.commentCount ?? 0}</span>
            </div>
          </div>
          <button
            onClick={e => handleDelete(post.id, e)}
            style={{
              background:'transparent', border:'none', color:'var(--muted2)',
              cursor:'pointer', fontSize:12, padding:'4px 8px', borderRadius:4,
              flexShrink:0, transition:'color 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}
