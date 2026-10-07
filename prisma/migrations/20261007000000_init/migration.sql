-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 200,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_daily_claim" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "squad_value" DECIMAL(12,2) NOT NULL DEFAULT 200,
    "manager_name" TEXT NOT NULL DEFAULT 'Boşta',
    "logo_url" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "matchday" INTEGER NOT NULL,
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "is_finished" BOOLEAN NOT NULL DEFAULT false,
    "odds_home" DECIMAL(10,2) NOT NULL,
    "odds_draw" DECIMAL(10,2) NOT NULL,
    "odds_away" DECIMAL(10,2) NOT NULL,
    "is_banko" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "osm_match_id" TEXT,
    "osm_home_team_id" TEXT,
    "osm_away_team_id" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "from_team" TEXT NOT NULL,
    "to_team" TEXT NOT NULL,
    "position" TEXT,
    "matchday" INTEGER,
    "market_value" TEXT,
    "fee" TEXT,
    "date_label" TEXT NOT NULL,
    "transfer_date" DATE NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standings" (
    "team_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID,
    "prediction" TEXT NOT NULL,
    "bet_amount" DECIMAL(12,2) NOT NULL,
    "odds" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bet_type" TEXT NOT NULL DEFAULT 'single',
    "combo_details" JSONB,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_settings" (
    "id" INTEGER NOT NULL,
    "active_matchday" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "league_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quotes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "profile_id" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("profile_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "matches_osm_match_id_key" ON "matches"("osm_match_id");

-- CreateIndex
CREATE INDEX "matches_matchday_idx" ON "matches"("matchday");

-- CreateIndex
CREATE UNIQUE INDEX "matches_matchday_home_team_id_away_team_id_key" ON "matches"("matchday", "home_team_id", "away_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_fingerprint_key" ON "transfers"("fingerprint");

-- CreateIndex
CREATE INDEX "transfers_transfer_date_idx" ON "transfers"("transfer_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "standings_rank_key" ON "standings"("rank");

-- CreateIndex
CREATE INDEX "bets_match_id_status_idx" ON "bets"("match_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotes_user_id_created_at_key" ON "daily_quotes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quotes" ADD CONSTRAINT "daily_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

