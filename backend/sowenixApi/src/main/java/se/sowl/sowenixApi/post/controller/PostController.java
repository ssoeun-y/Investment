package se.sowl.sowenixApi.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.sowl.sowenixApi.common.CommonResponse;
import se.sowl.sowenixApi.post.dto.LikeResponse;
import se.sowl.sowenixApi.post.dto.PostRequest;
import se.sowl.sowenixApi.post.dto.PostResponse;
import se.sowl.sowenixApi.post.service.PostService;
import se.sowl.sowenixDomain.user.domain.CustomOAuth2User;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping
    public CommonResponse<Page<PostResponse>> getPosts(
        @RequestParam(required = false) String category,
        @RequestParam(defaultValue = "latest") String sort,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return CommonResponse.ok(postService.getPosts(category, sort, PageRequest.of(page, size)));
    }

    @GetMapping("/{postId}")
    public CommonResponse<PostResponse> getPost(@PathVariable Long postId) {
        return CommonResponse.ok(postService.getPost(postId));
    }

    @GetMapping("/my")
    public CommonResponse<List<PostResponse>> getMyPosts(@AuthenticationPrincipal CustomOAuth2User user) {
        return CommonResponse.ok(postService.getMyPosts(user.getUserId()));
    }

    @PostMapping
    public CommonResponse<PostResponse> createPost(
        @AuthenticationPrincipal CustomOAuth2User user,
        @RequestBody PostRequest req
    ) {
        return CommonResponse.ok(postService.createPost(user.getUserId(), req));
    }

    @PutMapping("/{postId}")
    public CommonResponse<PostResponse> updatePost(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId,
        @RequestBody PostRequest req
    ) {
        return CommonResponse.ok(postService.updatePost(user.getUserId(), postId, req));
    }

    @DeleteMapping("/{postId}")
    public CommonResponse<Void> deletePost(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId
    ) {
        postService.deletePost(user.getUserId(), postId);
        return CommonResponse.ok();
    }

    @PostMapping("/{postId}/like")
    public CommonResponse<LikeResponse> toggleLike(
        @AuthenticationPrincipal CustomOAuth2User user,
        @PathVariable Long postId
    ) {
        return CommonResponse.ok(postService.toggleLike(user.getUserId(), postId));
    }
}
