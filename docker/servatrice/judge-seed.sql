-- Seeds a judge-flagged account for e2e tests.
--
-- Servatrice derives the IsJudge user-level flag from the `admin` column bitmask
-- (servatrice_database_interface.cpp: `is_admin & 4` -> IsJudge). admin = 4 is a
-- judge that is neither admin nor moderator. This mirrors the normal way a judge
-- is created (the same `admin` bit Command_AdjustMod sets), done at DB init so the
-- e2e suite has a deterministic judge login.
--
-- password_sha512 is `salt + base64(SHA512^1000(salt + password))` — the exact
-- format produced by both Servatrice's PasswordHasher::computeHash and webatrice's
-- hashPassword (packages/sockatrice/src/utils/passwordHasher.ts). Precomputed for
-- salt "e2eJudgeSalt0001" + password "password123" and validated against the
-- shared regression vector, so the seeded account logs in with that password.
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
