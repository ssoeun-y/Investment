package se.sowl.sowenixDomain.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.sowl.sowenixDomain.post.domain.PostLike;

import java.util.Optional;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    Optional<PostLike> findByPostIdAndUserId(Long postId, Long userId);
    void deleteByPostIdAndUserId(Long postId, Long userId);
}
