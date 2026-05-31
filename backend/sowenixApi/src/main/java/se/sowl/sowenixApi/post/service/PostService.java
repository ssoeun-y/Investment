package se.sowl.sowenixApi.post.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.sowl.sowenixApi.post.dto.LikeResponse;
import se.sowl.sowenixApi.post.dto.PostRequest;
import se.sowl.sowenixApi.post.dto.PostResponse;
import se.sowl.sowenixDomain.post.domain.Post;
import se.sowl.sowenixDomain.post.domain.PostLike;
import se.sowl.sowenixDomain.post.repository.PostLikeRepository;
import se.sowl.sowenixDomain.post.repository.PostRepository;
import se.sowl.sowenixDomain.user.domain.User;
import se.sowl.sowenixDomain.user.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final UserRepository userRepository;

    public Page<PostResponse> getPosts(String category, String sort, Pageable pageable) {
        Page<Post> page;
        boolean byLikes = "likes".equals(sort);
        if (category == null || category.isBlank() || "전체".equals(category)) {
            page = byLikes
                ? postRepository.findAllByOrderByLikeCountDesc(pageable)
                : postRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            page = byLikes
                ? postRepository.findByCategoryOrderByLikeCountDesc(category, pageable)
                : postRepository.findByCategoryOrderByCreatedAtDesc(category, pageable);
        }
        return page.map(PostResponse::from);
    }

    public PostResponse getPost(Long postId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게시글입니다."));
        return PostResponse.from(post);
    }

    public List<PostResponse> getMyPosts(Long userId) {
        return postRepository.findByAuthorIdOrderByCreatedAtDesc(userId).stream()
            .map(PostResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public PostResponse createPost(Long userId, PostRequest req) {
        User author = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        Post post = Post.builder()
            .category(req.getCategory())
            .title(req.getTitle())
            .content(req.getContent())
            .author(author)
            .build();
        return PostResponse.from(postRepository.save(post));
    }

    @Transactional
    public PostResponse updatePost(Long userId, Long postId, PostRequest req) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게시글입니다."));
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("수정 권한이 없습니다.");
        }
        post.update(req.getTitle(), req.getContent());
        return PostResponse.from(post);
    }

    @Transactional
    public void deletePost(Long userId, Long postId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게시글입니다."));
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("삭제 권한이 없습니다.");
        }
        postRepository.delete(post);
    }

    @Transactional
    public LikeResponse toggleLike(Long userId, Long postId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게시글입니다."));
        Optional<PostLike> existing = postLikeRepository.findByPostIdAndUserId(postId, userId);
        if (existing.isPresent()) {
            postLikeRepository.deleteByPostIdAndUserId(postId, userId);
            post.decrementLike();
            return new LikeResponse(false, post.getLikeCount());
        } else {
            postLikeRepository.save(PostLike.builder().postId(postId).userId(userId).build());
            post.incrementLike();
            return new LikeResponse(true, post.getLikeCount());
        }
    }
}
