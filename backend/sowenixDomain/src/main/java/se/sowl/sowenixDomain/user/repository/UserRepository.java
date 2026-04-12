package se.sowl.sowenixDomain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.sowl.sowenixDomain.user.domain.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailAndProvider(String email, String provider);
}
