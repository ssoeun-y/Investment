package se.sowl.sowenixDomain.oauth.domain;

import lombok.RequiredArgsConstructor;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;

@RequiredArgsConstructor
public enum OAuth2Extractor {
    GOOGLE(OAuth2Provider.GOOGLE, OAuth2Extractor::extractGoogleProfile),
    NAVER(OAuth2Provider.NAVER, OAuth2Extractor::extractNaverProfile),
    KAKAO(OAuth2Provider.KAKAO, OAuth2Extractor::extractKakaoProfile);

    private final OAuth2Provider provider;
    private final Function<Map<String, Object>, OAuth2Profile> extractor;

    public static OAuth2Profile extract(OAuth2Provider provider, Map<String, Object> attributes) {
        return Arrays.stream(values())
            .filter(extractor -> extractor.provider == provider)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Invalid provider: " + provider))
            .extractor.apply(attributes);
    }

    private static OAuth2Profile extractGoogleProfile(Map<String, Object> attributes) {
        return OAuth2Profile.builder()
            .name((String) attributes.get("name"))
            .email((String) attributes.get("email"))
            .build();
    }

    private static OAuth2Profile extractNaverProfile(Map<String, Object> attributes) {
        Map<String, Object> response = (Map<String, Object>) attributes.get("response");
        return OAuth2Profile.builder()
            .name((String) response.get("name"))
            .email((String) response.get("email"))
            .build();
    }

    private static OAuth2Profile extractKakaoProfile(Map<String, Object> attributes) {
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> kakaoProfile = (Map<String, Object>) kakaoAccount.get("profile");
        return OAuth2Profile.builder()
            .name((String) kakaoProfile.get("nickname"))
            .email((String) kakaoAccount.get("email"))
            .build();
    }
}

