package se.sowl.sowenixApi.post.dto;

import lombok.Builder;
import lombok.Getter;
import se.sowl.sowenixDomain.post.domain.Post;

import java.time.LocalDateTime;

@Getter
@Builder
public class PostResponse {
    private Long id;
    private String category;
    private String title;
    private String content;
    private Long authorId;
    private String authorName;
    private int likeCount;
    private int commentCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PostResponse from(Post post) {
        return PostResponse.builder()
            .id(post.getId())
            .category(post.getCategory())
            .title(post.getTitle())
            .content(post.getContent())
            .authorId(post.getAuthor().getId())
            .authorName(post.getAuthor().getNickname() != null
                ? post.getAuthor().getNickname()
                : post.getAuthor().getName())
            .likeCount(post.getLikeCount())
            .commentCount(post.getCommentCount())
            .createdAt(post.getCreatedAt())
            .updatedAt(post.getUpdatedAt())
            .build();
    }
}
