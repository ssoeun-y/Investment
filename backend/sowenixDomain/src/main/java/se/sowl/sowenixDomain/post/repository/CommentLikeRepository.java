package se.sowl.sowenixDomain.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.sowl.sowenixDomain.post.domain.CommentLike;

import java.util.Optional;

public interface CommentLikeRepository extends JpaRepository<CommentLike, Long> {
    Optional<CommentLike> findByCommentIdAndUserId(Long commentId, Long userId);
    void deleteByCommentIdAndUserId(Long commentId, Long userId);
}
