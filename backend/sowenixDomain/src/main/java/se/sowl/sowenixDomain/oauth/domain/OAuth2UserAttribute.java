package se.sowl.sowenixDomain.oauth.domain;

import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
public class OAuth2UserAttribute {
    private final Map<String, Object> attributes;

    public OAuth2UserAttribute(Map<String, Object> oAuth2Attributes, String userNameAttributeName, OAuth2Profile userProfile) {
        this.attributes = new LinkedHashMap<>(oAuth2Attributes);
        attributes.put(userNameAttributeName, oAuth2Attributes.get(userNameAttributeName));
        attributes.put("provider", userProfile.getProvider());
        attributes.put("name", userProfile.getName());
        attributes.put("email", userProfile.getEmail());
    }
}
