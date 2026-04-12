package se.sowl.sowenixApi.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EnableJpaRepositories(basePackages = "se.sowl.sowenixDomain")
public class JpaConfig {
}
