package se.sowl.sowenixDomain.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.sowl.sowenixDomain.post.domain.Comment;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);
}
