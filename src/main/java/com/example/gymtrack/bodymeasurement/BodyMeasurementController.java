package com.example.gymtrack.bodymeasurement;

import com.example.gymtrack.auth.CurrentUser;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BodyMeasurementController {

	private final BodyMeasurementService service;

	public BodyMeasurementController(BodyMeasurementService service) {
		this.service = service;
	}

	@GetMapping("/api/body-measurements")
	public BodyMeasurementsResponse list(@AuthenticationPrincipal CurrentUser currentUser) {
		return service.list(currentUser.id());
	}

	@PostMapping("/api/body-measurements")
	public ResponseEntity<BodyMeasurementResponse> create(@AuthenticationPrincipal CurrentUser currentUser,
			@Valid @RequestBody BodyMeasurementRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUser.id(), request));
	}

	@PutMapping("/api/body-measurements/{id}")
	public BodyMeasurementResponse replace(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id,
			@Valid @RequestBody BodyMeasurementRequest request) {
		return service.replace(currentUser.id(), id, request);
	}

	@DeleteMapping("/api/body-measurements/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		service.delete(currentUser.id(), id);
		return ResponseEntity.noContent().build();
	}

	/** Body read as a plain map so a missing key and non-numeric values come back as INVALID_TARGET_WEIGHT. */
	@PutMapping("/api/body-measurements/target-weight")
	public TargetWeightResponse setTargetWeight(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestBody Map<String, Object> body) {
		if (!body.containsKey("targetWeightKg")) {
			throw new InvalidTargetWeightException("targetWeightKg is required (20-500 or null)");
		}
		return new TargetWeightResponse(service.setTargetWeight(currentUser.id(), body.get("targetWeightKg")));
	}

}
