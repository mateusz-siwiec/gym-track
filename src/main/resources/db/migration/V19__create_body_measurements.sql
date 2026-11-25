create table body_measurements (
    id uuid not null primary key,
    user_id uuid not null references users (id),
    measured_on date not null,
    weight_kg numeric(5,2),
    waist_cm numeric(4,1),
    chest_cm numeric(4,1),
    hips_cm numeric(4,1),
    arm_left_cm numeric(4,1),
    arm_right_cm numeric(4,1),
    thigh_left_cm numeric(4,1),
    thigh_right_cm numeric(4,1),
    calf_left_cm numeric(4,1),
    calf_right_cm numeric(4,1),
    created_at timestamp(6) with time zone not null,
    updated_at timestamp(6) with time zone not null,
    constraint ck_body_measurements_weight check (weight_kg between 20 and 500),
    constraint ck_body_measurements_waist check (waist_cm between 5 and 300),
    constraint ck_body_measurements_chest check (chest_cm between 5 and 300),
    constraint ck_body_measurements_hips check (hips_cm between 5 and 300),
    constraint ck_body_measurements_arm_left check (arm_left_cm between 5 and 300),
    constraint ck_body_measurements_arm_right check (arm_right_cm between 5 and 300),
    constraint ck_body_measurements_thigh_left check (thigh_left_cm between 5 and 300),
    constraint ck_body_measurements_thigh_right check (thigh_right_cm between 5 and 300),
    constraint ck_body_measurements_calf_left check (calf_left_cm between 5 and 300),
    constraint ck_body_measurements_calf_right check (calf_right_cm between 5 and 300),
    constraint ck_body_measurements_not_empty check (
        weight_kg is not null or waist_cm is not null or chest_cm is not null or hips_cm is not null
        or arm_left_cm is not null or arm_right_cm is not null or thigh_left_cm is not null
        or thigh_right_cm is not null or calf_left_cm is not null or calf_right_cm is not null)
);

create index idx_body_measurements_user_measured_on
    on body_measurements (user_id, measured_on desc, created_at desc);

alter table users
    add column target_weight_kg numeric(5,2),
    add constraint ck_users_target_weight check (target_weight_kg between 20 and 500);
