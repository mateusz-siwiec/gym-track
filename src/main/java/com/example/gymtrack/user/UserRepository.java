package com.example.gymtrack.user;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByEmail(String email);

	/** Updates only the target weight column, so it cannot overwrite concurrent changes to other columns. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("update User u set u.targetWeightKg = :target where u.id = :id")
	int updateTargetWeight(@Param("id") UUID id, @Param("target") BigDecimal target);

}
