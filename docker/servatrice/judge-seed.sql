-- Seeds privileged accounts for e2e tests: a judge, a moderator and an admin.
-- (The admin is `e2e_superuser`: servatrice-e2e.ini's disallowedwords rejects "admin" in user names.)
--
-- Servatrice derives the user-level flags from the `admin` column bitmask
-- (servatrice_database_interface.cpp): `is_admin & 1` -> IsAdmin | IsModerator,
-- `is_admin & 2` -> IsModerator, `is_admin & 4` -> IsJudge. admin = 4 is a judge
-- that is neither admin nor moderator. This mirrors the normal way these roles
-- are granted (the same bits Command_AdjustMod sets), done at DB init so the e2e
-- suite has deterministic privileged logins.
--
-- password_sha512 is `salt + base64(SHA512^1000(salt + password))` — the exact
-- format produced by both Servatrice's PasswordHasher::computeHash and webatrice's
-- hashPassword (packages/sockatrice/src/utils/passwordHasher.ts). Precomputed for
-- salt "e2eJudgeSalt0001" + password "password123" and validated against the
-- shared regression vector, so the seeded accounts log in with that password (the
-- hash does not involve the user name, so every account reuses it).
--
-- Runs after servatrice.sql (see docker-compose.e2e.yml: copied into the init
-- volume as zz-judge-seed.sql so MySQL executes it last, alphabetically), against
-- the `servatrice` database (MYSQL_DATABASE), where cockatrice_users lives.

INSERT INTO cockatrice_users
  (admin, name, realname, password_sha512, email, country, avatar_bmp,
   registrationDate, active, clientid, adminnotes, privlevel, privlevelStartDate, privlevelEndDate)
VALUES
  (4, 'e2e_judge', '',
   'e2eJudgeSalt0001eR9xr14F8Fi7+K8J4Zi85Xh0GzNs0GBmW4paPsLgmgXzzSoIT1U9MrqkLt1YBQwIW0m6HYw5niKjU5Rg8zmhoA==',
   '', '', '', NOW(), 1, '', '', 'NONE', NOW(), NOW())
ON DUPLICATE KEY UPDATE admin = 4;

INSERT INTO cockatrice_users
  (admin, name, realname, password_sha512, email, country, avatar_bmp,
   registrationDate, active, clientid, adminnotes, privlevel, privlevelStartDate, privlevelEndDate)
VALUES
  (2, 'e2e_moderator', '',
   'e2eJudgeSalt0001eR9xr14F8Fi7+K8J4Zi85Xh0GzNs0GBmW4paPsLgmgXzzSoIT1U9MrqkLt1YBQwIW0m6HYw5niKjU5Rg8zmhoA==',
   '', '', '', NOW(), 1, '', '', 'NONE', NOW(), NOW())
ON DUPLICATE KEY UPDATE admin = 2;

INSERT INTO cockatrice_users
  (admin, name, realname, password_sha512, email, country, avatar_bmp,
   registrationDate, active, clientid, adminnotes, privlevel, privlevelStartDate, privlevelEndDate)
VALUES
  (1, 'e2e_superuser', '',
   'e2eJudgeSalt0001eR9xr14F8Fi7+K8J4Zi85Xh0GzNs0GBmW4paPsLgmgXzzSoIT1U9MrqkLt1YBQwIW0m6HYw5niKjU5Rg8zmhoA==',
   '', '', '', NOW(), 1, '', '', 'NONE', NOW(), NOW())
ON DUPLICATE KEY UPDATE admin = 1;
