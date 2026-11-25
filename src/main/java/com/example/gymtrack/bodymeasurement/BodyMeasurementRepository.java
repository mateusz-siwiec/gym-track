package com.example.gymtrack.bodymeasurement;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BodyMeasurementRepository extends JpaRepository<BodyMeasurement, UUID> {

	List<BodyMeasurement> findByUserIdOrderByMeasuredOnDescCreatedAtDesc(UUID userId);

	Optional<BodyMeasurement> findByIdAndUserId(UUID id, UUID userId);

}
