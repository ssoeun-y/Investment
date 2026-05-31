package se.sowl.sowenixApi.post.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.sowl.sowenixApi.post.dto.CommentRequest;
import se.sowl.sowenixApi.post.dto.CommentResponse;
import se.sowl.sowenixApi.post.dto.LikeResponse;
import se.sowl.sowenixDomain.post.domain.Comment;
import se.sowl.sowenixDomain.post.domain.CommentLike;
import se.sowl.sowenixDomain.post.domain.Post;
import se.sowl.sowenixDomain.post.repository.CommentLikeRepository;
import se.sowl.sowenixDomain.post.repository.CommentRepository;
import se.sowl.sowenixDomain.post.repository.PostRepository;
import se.sowl.sowenixDomain.user.domain.User;
import se.sowl.sowenixDomain.user.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public List<CommentResponse> getComments(Long postId) {
        return commentRepository.findByPostIdOrderByCreatedAtAsc(postId).stream()
            .map(CommentResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponse createComment(Long userId, Long postId, CommentRequest req) {
        User author = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게시글입니다."));
        Comment comment = Comment.builder()
            .post(post)
            .author(author)
            .content(req.getContent())
            .build();
        post.incrementComment();
        return CommentResponse.from(commentRepository.save(comment));
    }

    @Transactional
    public CommentResponse updateComment(Long userId, Long commentId, CommentRequest req) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("수정 권한이 없습니다.");
        }
        comment.update(req.getContent());
        return CommentResponse.from(comment);
    }

    @Transactional
    public void deleteComment(Long userId, Long commentId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("삭제 권한이 없습니다.");
        }
        Post post = comment.getPost();
        post.decrementComment();
        commentRepository.delete(comment);
    }

    @Transactional
    public LikeResponse toggleLike(Long userId, Long commentId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));
        Optional<CommentLike> existing = commentLikeRepository.findByCommentIdAndUserId(commentId, userId);
        if (existing.isPresent()) {
            commentLikeRepository.deleteByCommentIdAndUserId(commentId, userId);
            comment.decrementLike();
            return new LikeResponse(false, comment.getLikeCount());
        } else {
            commentLikeRepository.save(CommentLike.builder().commentId(commentId).userId(userId).build());
            comment.incrementLike();
            return new LikeResponse(true, comment.getLikeCount());
        }
    }
}
