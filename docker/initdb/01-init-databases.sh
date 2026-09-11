#!/bin/sh
# Development and test each get their own database: `ddcore test` recreates
# what it touches, and doing that to the database you are clicking through is
# how you lose an afternoon's seed data.
set -e

create_db() {
    db=$1
    echo "Checking whether database '$db' exists..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 || \
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db;"
}

create_db demo_dev
create_db demo_test
