'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth }       from '../hooks/useAuth';
import { useMarketData } from '../hooks/useMarketData';
import Topbar            from '../components/Topbar';
import LoginModal        from '../components/LoginModal';
import styles            from './community.module.css';
import                        '../styles/dashboard.css';

const CATEGORIES = [
  { key: 'general',  label: '전체' },
  { key: 'coin',     label: '코인' },
  { key: 'kr_stock', label: '국내주식' },
  { key: 'us_stock', label: '해외주식' },
];
const CAT_ICON  = { coin: '🪙', kr_stock: '📈', us_stock: '🌐', general: '💬' };
const CAT_LABEL = { coin: '코인', kr_stock: '국내주식', us_stock: '해외주식', general: '전체' };

function fmtDate(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export default function CommunityPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [now, setNow]           = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // 목록 상태
  const [category, setCategory] = useState('general');
  const [sort, setSort]         = useState('latest');
  const [posts, setPosts]       = useState([]);
  const [page, setPage]         = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);

  // 글 상세 상태
  const [selectedPost, setSelectedPost]   = useState(null);
  const [comments, setComments]           = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput]   = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editComment, setEditComment]     = useState(null); // { id, content }

  // 글쓰기 상태
  const [showWrite, setShowWrite]     = useState(false);
  const [editPost, setEditPost]       = useState(null);
  const [writeForm, setWriteForm]     = useState({ category: 'coin', title: '', content: '' });
  const [writeSubmitting, setWriteSubmitting] = useState(false);

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();
  const { stockData, krStockData, cryptoData } = useMarketData();

  // clock
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 로그인 후 유저 정보 (본인 판별용)
  useEffect(() => {
    if (!isLoggedIn) { setCurrentUser(null); return; }
    fetch('/api/auth/session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCurrentUser(d.result?.user ?? null))
      .catch(() => setCurrentUser(null));
  }, [isLoggedIn]);

  // ── 글 목록 로드 ─────────────────────────────────────────
  const loadPosts = useCallback(async (nextPage = 0, append = false) => {
    setPostsLoading(true);
    try {
      const cat = category === 'general' ? '' : category;
      const res = await fetch(
        `/api/posts?category=${cat}&sort=${sort}&page=${nextPage}&size=20`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = data.result?.content ?? data.result ?? [];
      const last = data.result?.last ?? true;
      setPosts(prev => append ? [...prev, ...list] : list);
      setHasMore(!last);
      setPage(nextPage);
    } catch {
      if (!append) setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [category, sort]);

  useEffect(() => { loadPosts(0, false); }, [loadPosts]);

  // ── 댓글 로드 ────────────────────────────────────────────
  const loadComments = useCallback(async (postId) => {
    setCommentsLoading(true);
    setComments([]);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.result ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openPost = useCallback((post) => {
    setSelectedPost(post);
    setCommentInput('');
    setEditComment(null);
    loadComments(post.id);
  }, [loadComments]);

  // ── 글 좋아요 ────────────────────────────────────────────
  const handleLike = async (postId, e) => {
    e?.stopPropagation();
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const { liked, likeCount } = data.result ?? data;
      const update = p => p.id === postId ? { ...p, liked, likeCount } : p;
      setPosts(prev => prev.map(update));
      setSelectedPost(prev => prev?.id === postId ? { ...prev, liked, likeCount } : prev);
    } catch {}
  };

  // ── 글 삭제 ──────────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    if (!confirm('글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      setPosts(prev => prev.filter(p => p.id !== postId));
      setSelectedPost(null);
    } catch {}
  };

  // ── 글쓰기 열기 ──────────────────────────────────────────
  const openWrite = (post = null, e) => {
    e?.stopPropagation();
    setEditPost(post);
    setWriteForm(post
      ? { category: post.category, title: post.title, content: post.content }
      : { category: 'coin', title: '', content: '' }
    );
    setShowWrite(true);
  };

  // ── 글 등록/수정 제출 ────────────────────────────────────
  const handleWriteSubmit = async () => {
    if (!writeForm.title.trim() || !writeForm.content.trim()) return;
    setWriteSubmitting(true);
    try {
      const url    = editPost ? `/api/posts/${editPost.id}` : '/api/posts';
      const method = editPost ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(writeForm),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const saved = data.result ?? data;
      if (editPost) {
        setPosts(prev => prev.map(p => p.id === editPost.id ? saved : p));
        setSelectedPost(prev => prev?.id === editPost.id ? saved : prev);
      } else {
        setPosts(prev => [saved, ...prev]);
      }
      setShowWrite(false);
      setEditPost(null);
    } catch {}
    finally { setWriteSubmitting(false); }
  };

  // ── 댓글 등록 ────────────────────────────────────────────
  const handleCommentSubmit = async () => {
    if (!commentInput.trim() || !selectedPost) return;
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(prev => [...prev, data.result ?? data]);
      setCommentInput('');
      const inc = p => ({ ...p, commentCount: (p.commentCount ?? 0) + 1 });
      setSelectedPost(inc);
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? inc(p) : p));
    } catch {}
    finally { setCommentSubmitting(false); }
  };

  // ── 댓글 삭제 ────────────────────────────────────────────
  const handleDeleteComment = async (commentId) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      setComments(prev => prev.filter(c => c.id !== commentId));
      const dec = p => ({ ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) });
      setSelectedPost(dec);
      setPosts(prev => prev.map(p => p.id === selectedPost?.id ? dec(p) : p));
    } catch {}
  };

  // ── 댓글 좋아요 ──────────────────────────────────────────
  const handleCommentLike = async (commentId) => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const { liked, likeCount } = data.result ?? data;
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked, likeCount } : c));
    } catch {}
  };

  // ── 댓글 수정 제출 ───────────────────────────────────────
  const handleCommentEditSubmit = async (commentId) => {
    if (!editComment?.content?.trim()) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editComment.content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(prev => prev.map(c => c.id === commentId ? (data.result ?? data) : c));
      setEditComment(null);
    } catch {}
  };

  const isOwn = (authorId) => currentUser?.id && currentUser.id === authorId;

  // ────────────────────────────────────────────────────────
  return (
    <>
      {showLoginModal && (
        <LoginModal onLogin={handleKakaoLogin} onClose={() => setShowLoginModal(false)} />
      )}
      <Topbar
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        now={now}
        activePage="community"
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.page}>
        {/* 헤더 */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>💬 토론</h1>
          <button
            className={styles.writeBtn}
            onClick={() => isLoggedIn ? openWrite() : setShowLoginModal(true)}
          >
            + 글쓰기
          </button>
        </div>

        {/* 카테고리 탭 */}
        <div className={styles.tabRow}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`${styles.tabBtn}${category === cat.key ? ' ' + styles.active : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 정렬 */}
        <div className={styles.sortRow}>
          {[{ k:'latest', l:'최신순' }, { k:'popular', l:'인기순' }].map(s => (
            <button
              key={s.k}
              className={`${styles.sortBtn}${sort === s.k ? ' ' + styles.active : ''}`}
              onClick={() => setSort(s.k)}
            >{s.l}</button>
          ))}
        </div>

        {/* 글 목록 */}
        {postsLoading && posts.length === 0 ? (
          <div className={styles.emptyBox}>로딩 중...</div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyBox}>
            <span style={{ fontSize:24 }}>📝</span>
            <span>게시글이 없습니다</span>
            <span style={{ fontSize:11 }}>첫 번째 글을 작성해보세요</span>
          </div>
        ) : (
          <>
            <div className={styles.postList}>
              {posts.map(post => (
                <div key={post.id} className={styles.postCard} onClick={() => openPost(post)}>
                  <div className={styles.postTop}>
                    <span className={styles.catChip}>
                      {CAT_ICON[post.category]} {CAT_LABEL[post.category] ?? post.category}
                    </span>
                    <span className={styles.postTime}>{fmtDate(post.createdAt)}</span>
                  </div>
                  <div className={styles.postTitle}>{post.title}</div>
                  <div className={styles.postMeta}>
                    <span className={styles.postAuthor}>
                      {post.author?.nickname ?? post.author?.name ?? '익명'}
                    </span>
                    <span className={styles.metaDot}>·</span>
                    <button
                      className={`${styles.likeBtn}${post.liked ? ' ' + styles.liked : ''}`}
                      onClick={e => handleLike(post.id, e)}
                    >
                      {post.liked ? '♥' : '♡'} {post.likeCount ?? 0}
                    </button>
                    <span className={styles.metaDot}>·</span>
                    <span className={styles.commentCount}>💬 {post.commentCount ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => loadPosts(page + 1, true)}
                disabled={postsLoading}
              >
                {postsLoading ? '로딩 중...' : '더 보기'}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── 글 상세 모달 ─────────────────────────────────────── */}
      {selectedPost && (
        <div className={styles.overlay} onClick={() => setSelectedPost(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.catChip}>
                {CAT_ICON[selectedPost.category]} {CAT_LABEL[selectedPost.category]}
              </span>
              <button className={styles.closeBtn} onClick={() => setSelectedPost(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <h2 className={styles.detailTitle}>{selectedPost.title}</h2>
              <div className={styles.detailMeta}>
                <span>{selectedPost.author?.nickname ?? selectedPost.author?.name ?? '익명'}</span>
                <span className={styles.metaDot}>·</span>
                <span>{fmtDate(selectedPost.createdAt)}</span>
                {selectedPost.updatedAt && (
                  <span style={{ fontSize:10, color:'var(--muted)' }}>(수정됨)</span>
                )}
                {isOwn(selectedPost.author?.id) && (
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    <button className={styles.textBtn} onClick={e => openEdit(selectedPost, e)}>수정</button>
                    <button
                      className={`${styles.textBtn} ${styles.danger}`}
                      onClick={() => handleDeletePost(selectedPost.id)}
                    >삭제</button>
                  </div>
                )}
              </div>

              <div className={styles.detailContent}>{selectedPost.content}</div>

              <div className={styles.detailActions}>
                <button
                  className={`${styles.likeBtn} ${styles.likeBtn_lg}${selectedPost.liked ? ' ' + styles.liked : ''}`}
                  onClick={() => handleLike(selectedPost.id)}
                >
                  {selectedPost.liked ? '♥' : '♡'} {selectedPost.likeCount ?? 0}
                </button>
              </div>

              {/* 댓글 */}
              <div className={styles.commentSection}>
                <div className={styles.commentHeader}>댓글 {selectedPost.commentCount ?? 0}개</div>

                {commentsLoading ? (
                  <div className={styles.emptyBox} style={{ padding:'16px 0', fontSize:12 }}>로딩 중...</div>
                ) : comments.length === 0 ? (
                  <div className={styles.emptyBox} style={{ padding:'16px 0', fontSize:12 }}>첫 댓글을 남겨보세요</div>
                ) : (
                  <div className={styles.commentList}>
                    {comments.map(comment => (
                      <div key={comment.id} className={styles.commentItem}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAuthor}>
                            {comment.author?.nickname ?? comment.author?.name ?? '익명'}
                          </span>
                          <span className={styles.metaDot}>·</span>
                          <span className={styles.commentTime}>{fmtDate(comment.createdAt)}</span>
                          {isOwn(comment.author?.id) && (
                            <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
                              <button
                                className={styles.textBtn}
                                onClick={() => setEditComment({ id: comment.id, content: comment.content })}
                              >수정</button>
                              <button
                                className={`${styles.textBtn} ${styles.danger}`}
                                onClick={() => handleDeleteComment(comment.id)}
                              >삭제</button>
                            </div>
                          )}
                        </div>

                        {editComment?.id === comment.id ? (
                          <div className={styles.commentEditRow}>
                            <input
                              className={styles.commentEditInput}
                              value={editComment.content}
                              onChange={e => setEditComment({ ...editComment, content: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && handleCommentEditSubmit(comment.id)}
                              autoFocus
                            />
                            <button className={styles.submitSmall} onClick={() => handleCommentEditSubmit(comment.id)}>저장</button>
                            <button className={styles.cancelSmall} onClick={() => setEditComment(null)}>취소</button>
                          </div>
                        ) : (
                          <div className={styles.commentText}>{comment.content}</div>
                        )}

                        <button
                          className={`${styles.likeBtn}${comment.liked ? ' ' + styles.liked : ''}`}
                          style={{ fontSize:11, marginTop:4 }}
                          onClick={() => handleCommentLike(comment.id)}
                        >
                          {comment.liked ? '♥' : '♡'} {comment.likeCount ?? 0}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 댓글 입력 */}
                <div className={styles.commentInputRow}>
                  <input
                    className={styles.commentInput}
                    placeholder={isLoggedIn ? '댓글을 입력하세요... (Enter 등록)' : '로그인 후 댓글 작성 가능'}
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCommentSubmit())}
                    disabled={!isLoggedIn}
                    onClick={() => !isLoggedIn && setShowLoginModal(true)}
                  />
                  <button
                    className={styles.submitBtn}
                    onClick={handleCommentSubmit}
                    disabled={commentSubmitting || !commentInput.trim() || !isLoggedIn}
                  >
                    {commentSubmitting ? '...' : '등록'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 글쓰기/수정 모달 ──────────────────────────────────── */}
      {showWrite && (
        <div className={styles.overlay} onClick={() => setShowWrite(false)}>
          <div className={`${styles.modal} ${styles.writeModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
                {editPost ? '글 수정' : '글쓰기'}
              </span>
              <button className={styles.closeBtn} onClick={() => setShowWrite(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.writeRow}>
                <label className={styles.writeLabel}>카테고리</label>
                <div className={styles.catBtnRow}>
                  {CATEGORIES.filter(c => c.key !== 'general').map(cat => (
                    <button
                      key={cat.key}
                      className={`${styles.catSelectBtn}${writeForm.category === cat.key ? ' ' + styles.active : ''}`}
                      onClick={() => setWriteForm(f => ({ ...f, category: cat.key }))}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.writeRow}>
                <label className={styles.writeLabel}>제목</label>
                <input
                  className={styles.writeInput}
                  placeholder="제목을 입력하세요"
                  value={writeForm.title}
                  maxLength={100}
                  onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className={styles.writeRow}>
                <label className={styles.writeLabel}>내용</label>
                <textarea
                  className={styles.writeTextarea}
                  placeholder="내용을 입력하세요"
                  value={writeForm.content}
                  rows={6}
                  onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>

              <div className={styles.writeBtns}>
                <button className={styles.cancelBtn} onClick={() => setShowWrite(false)}>취소</button>
                <button
                  className={styles.registerBtn}
                  onClick={handleWriteSubmit}
                  disabled={writeSubmitting || !writeForm.title.trim() || !writeForm.content.trim()}
                >
                  {writeSubmitting ? '저장 중...' : editPost ? '수정하기' : '등록하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
