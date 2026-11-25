package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.common.ResourceNotFoundException;

public class BodyMeasurementNotFoundException extends ResourceNotFoundException {

	public BodyMeasurementNotFoundException(String message) {
		super(ErrorCode.BODY_MEASUREMENT_NOT_FOUND, message);
	}

}
