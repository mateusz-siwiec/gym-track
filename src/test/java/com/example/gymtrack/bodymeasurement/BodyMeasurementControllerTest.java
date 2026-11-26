package com.example.gymtrack.bodymeasurement;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class BodyMeasurementControllerTest {

	private static final String URL = "/api/body-measurements";

	private static final List<String> TAPE_FIELDS = List.of("waistCm", "chestCm", "hipsCm", "armLeftCm",
			"armRightCm", "thighLeftCm", "thighRightCm", "calfLeftCm", "calfRightCm");

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private BodyMeasurementRepository repository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	private final List<User> createdUsers = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		for (User user : createdUsers) {
			repository.deleteAll(repository.findByUserIdOrderByMeasuredOnDescCreatedAtDesc(user.getId()));
		}
		userRepository.deleteAll(createdUsers);
		createdUsers.clear();
	}

	private String bearerToken() {
		User user = userRepository.save(new User("body-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		createdUsers.add(user);
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder,
			String token, String body) throws Exception {
		builder.header(HttpHeaders.AUTHORIZATION, token);
		if (body != null) {
			builder.contentType(MediaType.APPLICATION_JSON).content(body);
		}
		return mockMvc.perform(builder);
	}

	private String json(String date, String field, String value) {
		return "{\"measuredOn\":\"" + date + "\",\"" + field + "\":" + value + "}";
	}

	private String createWeight(String token, String date, String weight) throws Exception {
		String response = send(post(URL), token, json(date, "weightKg", weight)).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(response, "$.id");
	}

	@Test
	void routesWithoutTokenReturnUnauthorized() throws Exception {
		mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
		mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(json("2024-01-01", "weightKg", "80")))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(put(URL + "/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
			.content(json("2024-01-01", "weightKg", "80"))).andExpect(status().isUnauthorized());
		mockMvc.perform(delete(URL + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
		mockMvc.perform(put(URL + "/target-weight").contentType(MediaType.APPLICATION_JSON)
			.content("{\"targetWeightKg\":80}")).andExpect(status().isUnauthorized());
	}

	@Test
	void createReturnsEntryAndListIsNewestFirstWithCreationOrderOnSameDate() throws Exception {
		String token = bearerToken();
		String older = createWeight(token, "2024-01-01", "80.5");
		String firstOnDate = createWeight(token, "2024-03-01", "79");
		String secondOnDate = createWeight(token, "2024-03-01", "78.25");

		send(get(URL), token, null).andExpect(status().isOk())
			.andExpect(jsonPath("$.targetWeightKg", is(nullValue())))
			.andExpect(jsonPath("$.entries", hasSize(3)))
			.andExpect(jsonPath("$.entries[0].id", is(secondOnDate)))
			.andExpect(jsonPath("$.entries[1].id", is(firstOnDate)))
			.andExpect(jsonPath("$.entries[2].id", is(older)))
			.andExpect(jsonPath("$.entries[2].measuredOn", is("2024-01-01")))
			.andExpect(jsonPath("$.entries[2].weightKg", is(80.5)))
			.andExpect(jsonPath("$.entries[2].waistCm", is(nullValue())))
			.andExpect(jsonPath("$.entries[2].createdAt", is(notNullValue())))
			.andExpect(jsonPath("$.entries[2].updatedAt", is(notNullValue())));
	}

	@Test
	void putReplacesEntryAndClearsOmittedField() throws Exception {
		String token = bearerToken();
		String response = send(post(URL), token,
				"{\"measuredOn\":\"2024-02-01\",\"weightKg\":80,\"waistCm\":90.5}").andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String id = JsonPath.read(response, "$.id");

		send(put(URL + "/" + id), token, "{\"measuredOn\":\"2024-02-02\",\"waistCm\":89}").andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(id)))
			.andExpect(jsonPath("$.measuredOn", is("2024-02-02")))
			.andExpect(jsonPath("$.weightKg", is(nullValue())))
			.andExpect(jsonPath("$.waistCm", is(89.0)));
	}

	@Test
	void putCannotClearEveryValue() throws Exception {
		String token = bearerToken();
		String id = createWeight(token, "2024-02-01", "80");

		send(put(URL + "/" + id), token, "{\"measuredOn\":\"2024-02-01\",\"weightKg\":null}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")));
	}

	@Test
	void deleteRemovesEntry() throws Exception {
		String token = bearerToken();
		String id = createWeight(token, "2024-02-01", "80");

		send(delete(URL + "/" + id), token, null).andExpect(status().isNoContent());

		send(get(URL), token, null).andExpect(jsonPath("$.entries", hasSize(0)));
		send(delete(URL + "/" + id), token, null).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("BODY_MEASUREMENT_NOT_FOUND")));
	}

	@Test
	void anotherUsersEntryIsNotFoundAndNeverListed() throws Exception {
		String owner = bearerToken();
		String other = bearerToken();
		String id = createWeight(owner, "2024-02-01", "80");

		send(put(URL + "/" + id), other, json("2024-02-01", "weightKg", "70")).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("BODY_MEASUREMENT_NOT_FOUND")));
		send(delete(URL + "/" + id), other, null).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("BODY_MEASUREMENT_NOT_FOUND")));
		send(get(URL), other, null).andExpect(jsonPath("$.entries", hasSize(0)));
		send(get(URL), owner, null).andExpect(jsonPath("$.entries", hasSize(1)))
			.andExpect(jsonPath("$.entries[0].weightKg", is(80.0)));
	}

	@Test
	void requestWithoutAnyValueIsRejected() throws Exception {
		String token = bearerToken();

		send(post(URL), token, "{\"measuredOn\":\"2024-02-01\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")));
		send(post(URL), token, "{\"measuredOn\":\"2024-02-01\",\"weightKg\":null,\"waistCm\":null}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")));
	}

	@Test
	void missingOrMalformedDateIsRejected() throws Exception {
		String token = bearerToken();

		send(post(URL), token, "{\"weightKg\":80}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("measuredOn")));
		send(post(URL), token, json("not-a-date", "weightKg", "80")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("MALFORMED_BODY")));
	}

	@Test
	void weightBoundaries() throws Exception {
		String token = bearerToken();

		for (String ok : new String[] { "20", "500", "20.01", "499.99" }) {
			send(post(URL), token, json("2024-02-01", "weightKg", ok)).andExpect(status().isCreated());
		}
		for (String bad : new String[] { "19.99", "500.01", "0", "-5", "80.123" }) {
			send(post(URL), token, json("2024-02-01", "weightKg", bad)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
				.andExpect(jsonPath("$.field", is("weightKg")));
		}
	}

	@Test
	void everyTapeFieldHonoursItsBoundaries() throws Exception {
		String token = bearerToken();

		for (String field : TAPE_FIELDS) {
			for (String ok : new String[] { "5", "300", "5.1", "299.9" }) {
				send(post(URL), token, json("2024-02-01", field, ok)).andExpect(status().isCreated())
					.andExpect(jsonPath("$." + field, is(Double.parseDouble(ok))));
			}
			for (String bad : new String[] { "4.9", "300.1", "0", "-1", "50.55" }) {
				send(post(URL), token, json("2024-02-01", field, bad)).andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
					.andExpect(jsonPath("$.field", is(field)));
			}
		}
	}

	@Test
	void dateOneDayAheadIsAcceptedAndTwoDaysAheadRejected() throws Exception {
		String token = bearerToken();
		LocalDate today = LocalDate.now(ZoneOffset.UTC);

		send(post(URL), token, json(today.plusDays(1).toString(), "weightKg", "80")).andExpect(status().isCreated());
		send(post(URL), token, json(today.plusDays(2).toString(), "weightKg", "80")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("measuredOn")));
	}

	@Test
	void dateBefore1950IsRejected() throws Exception {
		String token = bearerToken();

		send(post(URL), token, json("1950-01-01", "weightKg", "80")).andExpect(status().isCreated());
		send(post(URL), token, json("1949-12-31", "weightKg", "80")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("measuredOn")));
	}

	@Test
	void targetWeightCanBeSetReadAndCleared() throws Exception {
		String token = bearerToken();

		send(put(URL + "/target-weight"), token, "{\"targetWeightKg\":72.5}").andExpect(status().isOk())
			.andExpect(jsonPath("$.targetWeightKg", is(72.5)));
		send(get(URL), token, null).andExpect(jsonPath("$.targetWeightKg", is(72.5)));

		send(put(URL + "/target-weight"), token, "{\"targetWeightKg\":null}").andExpect(status().isOk())
			.andExpect(jsonPath("$.targetWeightKg", is(nullValue())));
		send(get(URL), token, null).andExpect(jsonPath("$.targetWeightKg", is(nullValue())));
	}

	@Test
	void targetWeightBoundariesAndInvalidValues() throws Exception {
		String token = bearerToken();

		for (String ok : new String[] { "20", "500" }) {
			send(put(URL + "/target-weight"), token, "{\"targetWeightKg\":" + ok + "}").andExpect(status().isOk());
		}
		for (String bad : new String[] { "19.99", "500.01", "0", "-3", "\"abc\"", "80.123", "true" }) {
			send(put(URL + "/target-weight"), token, "{\"targetWeightKg\":" + bad + "}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code", is("INVALID_TARGET_WEIGHT")));
		}
		send(put(URL + "/target-weight"), token, "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_TARGET_WEIGHT")));
	}

	@Test
	void targetWeightPathDoesNotCollideWithIdPath() throws Exception {
		String token = bearerToken();

		// Handled by the target-weight route (200), not by PUT /{id} (which would fail UUID parsing with 400).
		send(put(URL + "/target-weight"), token, "{\"targetWeightKg\":80}").andExpect(status().isOk());
		// A real UUID still reaches the id route.
		send(put(URL + "/" + UUID.randomUUID()), token, json("2024-02-01", "weightKg", "80"))
			.andExpect(status().isNotFound());
	}

}
