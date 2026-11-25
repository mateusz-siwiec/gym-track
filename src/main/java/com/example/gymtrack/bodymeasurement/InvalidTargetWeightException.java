package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.common.ErrorBody;
import com.example.gymtrack.common.ErrorCode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

public class InvalidTargetWeightException extends RuntimeException {

	public InvalidTargetWeightException(String message) {
		super(message);
	}

	@RestControllerAdvice
	static class Handler {

		@ExceptionHandler(InvalidTargetWeightException.class)
		public ResponseEntity<Map<String, Object>> handle(InvalidTargetWeightException ex) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorBody.of(ErrorCode.INVALID_TARGET_WEIGHT, ex.getMessage()));
		}

	}

}
