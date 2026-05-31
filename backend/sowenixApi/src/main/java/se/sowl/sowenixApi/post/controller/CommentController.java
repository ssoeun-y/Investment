package se.sowl.sowenixApi.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.sowl.sowenixApi.common.CommonResponse;
import se.sowl.sowenixApi.post.dto.CommentRequest;
import se.sowl.sowenixApi.post.dto.CommentResponse;
import se.sowl.sowenixApi.post.dto.LikeResponse;
import se.sowl.sowenixApi.post.service.CommentService;
import se.sowl.sowenixDomain.user.domain.CustomOAuth2User;

import java.util.List;

@RestController
@RequestMapping("/api/posts/{postId}/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping
    public CommonResponse<List<CommentResponse>> getComments(@PathVariable Long postId) {
        return CommonResponse.ok(commentService.getComments(postId));
    }

    @PostMapping
    public CommonResponse<CommentResponse> createComment(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId,
        @RequestBody CommentRequest req
    ) {
        return CommonResponse.ok(commentService.createComment(user.getUserId(), postId, req));
    }

    @PutMapping("/{commentId}")
    public CommonResponse<CommentResponse> updateComment(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId,
        @PathVariable Long commentId,
        @RequestBody CommentRequest req
    ) {
        return CommonResponse.ok(commentService.updateComment(user.getUserId(), commentId, req));
    }

    @DeleteMapping("/{commentId}")
    public CommonResponse<Void> deleteComment(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId,
        @PathVariable Long commentId
    ) {
        commentService.deleteComment(user.getUserId(), commentId);
        return CommonResponse.ok();
    }

    @PostMapping("/{commentId}/like")
    public CommonResponse<LikeResponse> toggleLike(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId,
        @PathVariable Long commentId
    ) {
        return CommonResponse.ok(commentService.toggleLike(user.getUserId(), commentId));
    }
}
