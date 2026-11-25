package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.common.ErrorBody;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Bean-validation failures (MethodArgumentNotValidException) are already mapped to the
 * error-body shape by the global AuthExceptionHandler, and not-found by CommonExceptionHandler,
 * so they are not handled here.
 */
@RestControllerAdvice
public class BodyMeasurementExceptionHandler {

	@ExceptionHandler(InvalidTargetWeightException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidTargetWeight(InvalidTargetWeightException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

}
