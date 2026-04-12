package se.sowl.sowenixApi.common;

import lombok.Data;

@Data
public class CommonResponse<T> {
    private String code;
    private String message;
    private T result;

    public CommonResponse(String code, String message, T result) {
        this.code = code;
        this.message = message;
        this.result = result;
    }

    public static <T> CommonResponse<T> ok(T result) {
        return new CommonResponse<>("SUCCESS", "성공", result);
    }

    public static <T> CommonResponse<T> ok() {
        return new CommonResponse<>("SUCCESS", "성공", null);
    }

    public static <T> CommonResponse<T> fail(String message) {
        return new CommonResponse<>("FAIL", message, null);
    }
}
