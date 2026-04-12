package se.sowl.sowenixApi.oauth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.sowl.sowenixApi.oauth.factory.OAuth2UserFactory;
import se.sowl.sowenixDomain.oauth.domain.*;
import se.sowl.sowenixDomain.user.domain.User;
import se.sowl.sowenixDomain.user.repository.UserRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;
    private final DefaultOAuth2UserService defaultOAuth2UserService;
    private final OAuth2UserFactory oAuth2UserFactory;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User loadedUser = defaultOAuth2UserService.loadUser(userRequest);
        OAuth2Profile profile = extractOAuth2Profile(userRequest, loadedUser);
        User user = getOrCreateUser(profile);
        OAuth2User oAuth2User = oAuth2UserFactory.createOAuth2User(userRequest, loadedUser, profile, user);
        return oAuth2UserFactory.createCustomOAuth2User(user, oAuth2User);
    }

    private OAuth2Profile extractOAuth2Profile(OAuth2UserRequest userRequest, OAuth2User oAuth2User) {
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        OAuth2Provider provider = OAuth2Provider.valueOf(registrationId.toUpperCase());
        OAuth2Profile profile = OAuth2Extractor.extract(provider, oAuth2User.getAttributes());
        profile.setProvider(registrationId);
        return profile;
    }

    private User getOrCreateUser(OAuth2Profile oAuth2Profile) {
        return userRepository.findByEmailAndProvider(oAuth2Profile.getEmail(), oAuth2Profile.getProvider())
            .orElseGet(() -> userRepository.save(oAuth2Profile.toUser()));
    }
}
