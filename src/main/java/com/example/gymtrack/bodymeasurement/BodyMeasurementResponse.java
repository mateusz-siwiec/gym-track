package com.example.gymtrack.bodymeasurement;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BodyMeasurementResponse(UUID id, LocalDate measuredOn, BigDecimal weightKg, BigDecimal waistCm,
		BigDecimal chestCm, BigDecimal hipsCm, BigDecimal armLeftCm, BigDecimal armRightCm, BigDecimal thighLeftCm,
		BigDecimal thighRightCm, BigDecimal calfLeftCm, BigDecimal calfRightCm, Instant createdAt,
		Instant updatedAt) {

	static BodyMeasurementResponse from(BodyMeasurement m) {
		return new BodyMeasurementResponse(m.getId(), m.getMeasuredOn(), m.getWeightKg(), m.getWaistCm(),
				m.getChestCm(), m.getHipsCm(), m.getArmLeftCm(), m.getArmRightCm(), m.getThighLeftCm(),
				m.getThighRightCm(), m.getCalfLeftCm(), m.getCalfRightCm(), m.getCreatedAt(), m.getUpdatedAt());
	}

}
