package se.sowl.sowenixDomain.oauth.domain;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import se.sowl.sowenixDomain.user.domain.User;

@Getter
@Setter
@Builder
public class OAuth2Profile {
    private String name;
    private String email;
    private String provider;

    public User toUser() {
        return User.builder()
            .name(name)
            .email(email)
            .provider(provider)
            .build();
    }
}
