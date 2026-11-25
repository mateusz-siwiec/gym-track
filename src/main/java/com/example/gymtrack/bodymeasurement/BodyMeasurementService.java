package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.common.InvalidFieldException;
import com.example.gymtrack.common.ResourceNotFoundException;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BodyMeasurementService {

	static final LocalDate EARLIEST_DATE = LocalDate.of(1950, 1, 1);

	static final BigDecimal MIN_TARGET_WEIGHT = new BigDecimal("20");

	static final BigDecimal MAX_TARGET_WEIGHT = new BigDecimal("500");

	private final BodyMeasurementRepository repository;

	private final UserRepository userRepository;

	public BodyMeasurementService(BodyMeasurementRepository repository, UserRepository userRepository) {
		this.repository = repository;
		this.userRepository = userRepository;
	}

	@Transactional(readOnly = true)
	public BodyMeasurementsResponse list(UUID userId) {
		BigDecimal target = userRepository.findById(userId).map(User::getTargetWeightKg).orElse(null);
		List<BodyMeasurementResponse> entries = repository.findByUserIdOrderByMeasuredOnDescCreatedAtDesc(userId)
			.stream()
			.map(BodyMeasurementResponse::from)
			.toList();
		return new BodyMeasurementsResponse(target, entries);
	}

	@Transactional
	public BodyMeasurementResponse create(UUID userId, BodyMeasurementRequest request) {
		validate(request);
		BodyMeasurement entry = new BodyMeasurement(userId);
		entry.apply(request);
		return BodyMeasurementResponse.from(repository.saveAndFlush(entry));
	}

	@Transactional
	public BodyMeasurementResponse replace(UUID userId, UUID id, BodyMeasurementRequest request) {
		BodyMeasurement entry = findOwned(userId, id);
		validate(request);
		entry.apply(request);
		return BodyMeasurementResponse.from(repository.saveAndFlush(entry));
	}

	@Transactional
	public void delete(UUID userId, UUID id) {
		repository.delete(findOwned(userId, id));
	}

	/** Stores the target weight (null clears it) and returns the stored value. */
	@Transactional
	public BigDecimal setTargetWeight(UUID userId, Object value) {
		BigDecimal target = value == null ? null : parseTarget(value);
		if (userRepository.updateTargetWeight(userId, target) == 0) {
			throw new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found");
		}
		return target;
	}

	private static BigDecimal parseTarget(Object value) {
		String message = "targetWeightKg must be a number from 20 to 500 (at most 2 decimals) or null";
		if (!(value instanceof Number)) {
			throw new InvalidTargetWeightException(message);
		}
		BigDecimal number;
		try {
			number = new BigDecimal(value.toString());
		}
		catch (NumberFormatException ex) {
			throw new InvalidTargetWeightException(message);
		}
		if (number.compareTo(MIN_TARGET_WEIGHT) < 0 || number.compareTo(MAX_TARGET_WEIGHT) > 0
				|| number.stripTrailingZeros().scale() > 2) {
			throw new InvalidTargetWeightException(message);
		}
		return number.setScale(2, RoundingMode.UNNECESSARY);
	}

	private BodyMeasurement findOwned(UUID userId, UUID id) {
		return repository.findByIdAndUserId(id, userId)
			.orElseThrow(() -> new BodyMeasurementNotFoundException("Body measurement not found"));
	}

	private static void validate(BodyMeasurementRequest request) {
		LocalDate date = request.measuredOn();
		if (date.isBefore(EARLIEST_DATE)) {
			throw new InvalidFieldException("measuredOn must not be before " + EARLIEST_DATE, "measuredOn", "Min");
		}
		if (date.isAfter(LocalDate.now(ZoneOffset.UTC).plusDays(1))) {
			throw new InvalidFieldException("measuredOn must not be in the future", "measuredOn", "Max");
		}
		if (!request.hasAnyValue()) {
			throw new InvalidFieldException("at least one measurement is required", "weightKg", "AtLeastOne");
		}
	}

}
