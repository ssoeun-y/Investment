package se.sowl.sowenixApi.post.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LikeResponse {
    private boolean liked;
    private int likeCount;
}
