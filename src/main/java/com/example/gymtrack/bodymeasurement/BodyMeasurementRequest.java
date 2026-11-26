package com.example.gymtrack.bodymeasurement;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Full representation of an entry: every field is replaced, so null clears a value. */
public record BodyMeasurementRequest(

	@NotNull
	LocalDate measuredOn,

	@DecimalMin("20") @DecimalMax("500") @Digits(integer = 3, fraction = 2)
	BigDecimal weightKg,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal waistCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal chestCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal hipsCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal armLeftCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal armRightCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal thighLeftCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal thighRightCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal calfLeftCm,

	@DecimalMin("5") @DecimalMax("300") @Digits(integer = 3, fraction = 1)
	BigDecimal calfRightCm

) {

	boolean hasAnyValue() {
		return weightKg != null || waistCm != null || chestCm != null || hipsCm != null || armLeftCm != null
				|| armRightCm != null || thighLeftCm != null || thighRightCm != null || calfLeftCm != null
				|| calfRightCm != null;
	}

}
