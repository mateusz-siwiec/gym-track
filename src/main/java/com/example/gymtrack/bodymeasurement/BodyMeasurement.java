package com.example.gymtrack.bodymeasurement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "body_measurements")
public class BodyMeasurement {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private UUID userId;

	@Column(nullable = false)
	private LocalDate measuredOn;

	@Column(precision = 5, scale = 2)
	private BigDecimal weightKg;

	@Column(precision = 4, scale = 1)
	private BigDecimal waistCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal chestCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal hipsCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal armLeftCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal armRightCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal thighLeftCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal thighRightCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal calfLeftCm;

	@Column(precision = 4, scale = 1)
	private BigDecimal calfRightCm;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected BodyMeasurement() {
	}

	public BodyMeasurement(UUID userId) {
		this.userId = userId;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	/** Replaces every value (null clears), normalising scale to the column definitions. */
	public void apply(BodyMeasurementRequest request) {
		this.measuredOn = request.measuredOn();
		this.weightKg = scale(request.weightKg(), 2);
		this.waistCm = scale(request.waistCm(), 1);
		this.chestCm = scale(request.chestCm(), 1);
		this.hipsCm = scale(request.hipsCm(), 1);
		this.armLeftCm = scale(request.armLeftCm(), 1);
		this.armRightCm = scale(request.armRightCm(), 1);
		this.thighLeftCm = scale(request.thighLeftCm(), 1);
		this.thighRightCm = scale(request.thighRightCm(), 1);
		this.calfLeftCm = scale(request.calfLeftCm(), 1);
		this.calfRightCm = scale(request.calfRightCm(), 1);
		this.updatedAt = Instant.now();
	}

	private static BigDecimal scale(BigDecimal value, int scale) {
		return value == null ? null : value.setScale(scale, RoundingMode.HALF_UP);
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public LocalDate getMeasuredOn() {
		return measuredOn;
	}

	public BigDecimal getWeightKg() {
		return weightKg;
	}

	public BigDecimal getWaistCm() {
		return waistCm;
	}

	public BigDecimal getChestCm() {
		return chestCm;
	}

	public BigDecimal getHipsCm() {
		return hipsCm;
	}

	public BigDecimal getArmLeftCm() {
		return armLeftCm;
	}

	public BigDecimal getArmRightCm() {
		return armRightCm;
	}

	public BigDecimal getThighLeftCm() {
		return thighLeftCm;
	}

	public BigDecimal getThighRightCm() {
		return thighRightCm;
	}

	public BigDecimal getCalfLeftCm() {
		return calfLeftCm;
	}

	public BigDecimal getCalfRightCm() {
		return calfRightCm;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
