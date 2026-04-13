# Sowenix Backend

## 실행 환경
- Java 17
- MySQL (로컬 설치 필요)

## 사전 준비

### MySQL 설정
```sql
CREATE DATABASE IF NOT EXISTS sowenix;
CREATE USER 'sowenix'@'localhost' IDENTIFIED BY 'sowenix1234';
GRANT ALL PRIVILEGES ON sowenix.* TO 'sowenix'@'localhost';
FLUSH PRIVILEGES;
```

## 실행 방법

```bash
cd backend
./gradlew :sowenixApi:bootRun --args='--spring.profiles.active=sowenix'
```

## 접속
- API 서버: http://localhost:8080