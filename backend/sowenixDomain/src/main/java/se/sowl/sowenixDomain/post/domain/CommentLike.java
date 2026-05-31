package se.sowl.sowenixDomain.post.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
    name = "comment_likes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"comment_id", "user_id"})
)
public class CommentLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "comment_id", nullable = false)
    private Long commentId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Builder
    public CommentLike(Long commentId, Long userId) {
        this.commentId = commentId;
        this.userId = userId;
    }
}
