package se.sowl.sowenixDomain.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import se.sowl.sowenixDomain.post.domain.Post;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Post> findByCategoryOrderByCreatedAtDesc(String category, Pageable pageable);
    Page<Post> findAllByOrderByLikeCountDesc(Pageable pageable);
    Page<Post> findByCategoryOrderByLikeCountDesc(String category, Pageable pageable);
    List<Post> findByAuthorIdOrderByCreatedAtDesc(Long authorId);
}
