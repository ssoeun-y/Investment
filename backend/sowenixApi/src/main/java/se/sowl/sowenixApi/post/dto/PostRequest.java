package se.sowl.sowenixApi.post.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PostRequest {
    private String category;
    private String title;
    private String content;
}
