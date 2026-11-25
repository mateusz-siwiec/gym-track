package com.example.gymtrack.bodymeasurement;

import java.math.BigDecimal;
import java.util.List;

public record BodyMeasurementsResponse(BigDecimal targetWeightKg, List<BodyMeasurementResponse> entries) {
}
