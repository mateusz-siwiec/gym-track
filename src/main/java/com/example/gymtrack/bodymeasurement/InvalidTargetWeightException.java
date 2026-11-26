package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.common.ErrorCode;

public class InvalidTargetWeightException extends RuntimeException {

	public InvalidTargetWeightException(String message) {
		super(message);
	}

	public ErrorCode getCode() {
		return ErrorCode.INVALID_TARGET_WEIGHT;
	}

}
