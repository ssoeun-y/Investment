package se.sowl.sowenixApi.oauth.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.sowl.sowenixApi.common.CommonResponse;
import se.sowl.sowenixDomain.user.domain.CustomOAuth2User;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class OAuthController {

    @GetMapping("/session")
    public CommonResponse<Map<String, Object>> getSession(@AuthenticationPrincipal CustomOAuth2User user) {
        if (user == null) {
            return CommonResponse.ok(Map.of("isLoggedIn", false));
        }
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getUserId());
        userInfo.put("name", user.getAttributes().get("name"));
        userInfo.put("nickname", user.getAttributes().get("nickname"));

        Map<String, Object> sessionInfo = new HashMap<>();
        sessionInfo.put("isLoggedIn", true);
        sessionInfo.put("user", userInfo);
        return CommonResponse.ok(sessionInfo);
    }
}
