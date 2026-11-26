package com.example.gymtrack.bodymeasurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class BodyMeasurementSchemaTest {

	private static final List<String> TAPE_COLUMNS = List.of("waist_cm", "chest_cm", "hips_cm", "arm_left_cm",
			"arm_right_cm", "thigh_left_cm", "thigh_right_cm", "calf_left_cm", "calf_right_cm");

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private JdbcTemplate jdbc;

	private UUID userId;

	@BeforeEach
	void setUp() {
		userId = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", userId,
				userId + "@example.com", "hash");
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from body_measurements where user_id = ?", userId);
		jdbc.update("delete from users where id = ?", userId);
	}

	private void insert(String column, Object value) {
		jdbc.update("insert into body_measurements (id, user_id, measured_on, " + column + ", created_at, updated_at) "
				+ "values (?, ?, current_date, ?, now(), now())", UUID.randomUUID(), userId, value);
	}

	@Test
	void inRangeValuesAreAccepted() {
		insert("weight_kg", 20);
		insert("weight_kg", 500);
		for (String column : TAPE_COLUMNS) {
			insert(column, 5);
			insert(column, 300);
		}

		Integer count = jdbc.queryForObject("select count(*) from body_measurements where user_id = ?",
				Integer.class, userId);
		assertThat(count).isEqualTo(2 + 2 * TAPE_COLUMNS.size());
	}

	@Test
	void outOfRangeWeightIsRejected() {
		for (double weight : new double[] { 19.99, 500.01, 0, -1 }) {
			assertThatThrownBy(() -> insert("weight_kg", weight)).isInstanceOf(DataIntegrityViolationException.class);
		}
	}

	@Test
	void outOfRangeTapeValuesAreRejected() {
		for (String column : TAPE_COLUMNS) {
			for (double value : new double[] { 4.9, 300.1, 0, -1 }) {
				assertThatThrownBy(() -> insert(column, value)).isInstanceOf(DataIntegrityViolationException.class);
			}
		}
	}

	@Test
	void rowWithAllMeasurementsNullIsRejected() {
		assertThatThrownBy(() -> insert("weight_kg", null)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void unknownUserIsRejected() {
		assertThatThrownBy(() -> jdbc.update("insert into body_measurements (id, user_id, measured_on, weight_kg, "
				+ "created_at, updated_at) values (?, ?, current_date, 80, now(), now())", UUID.randomUUID(),
				UUID.randomUUID())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void targetWeightRangeIsEnforced() {
		jdbc.update("update users set target_weight_kg = 20 where id = ?", userId);
		jdbc.update("update users set target_weight_kg = 500 where id = ?", userId);
		jdbc.update("update users set target_weight_kg = null where id = ?", userId);

		for (double target : new double[] { 19.99, 500.01 }) {
			assertThatThrownBy(() -> jdbc.update("update users set target_weight_kg = ? where id = ?", target, userId))
				.isInstanceOf(DataIntegrityViolationException.class);
		}
	}

}
