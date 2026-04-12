package se.sowl.sowenixApi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EntityScan(basePackages = {"se.sowl.sowenixDomain"})
@EnableCaching
public class sowenixApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(sowenixApiApplication.class, args);
    }

}
