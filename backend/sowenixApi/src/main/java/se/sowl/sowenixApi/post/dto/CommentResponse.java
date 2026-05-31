package se.sowl.sowenixApi.post.dto;

import lombok.Builder;
import lombok.Getter;
import se.sowl.sowenixDomain.post.domain.Comment;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponse {
    private Long id;
    private Long postId;
    private Long authorId;
    private String authorName;
    private String content;
    private int likeCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommentResponse from(Comment comment) {
        return CommentResponse.builder()
            .id(comment.getId())
            .postId(comment.getPost().getId())
            .authorId(comment.getAuthor().getId())
            .authorName(comment.getAuthor().getNickname() != null
                ? comment.getAuthor().getNickname()
                : comment.getAuthor().getName())
            .content(comment.getContent())
            .likeCount(comment.getLikeCount())
            .createdAt(comment.getCreatedAt())
            .updatedAt(comment.getUpdatedAt())
            .build();
    }
}
