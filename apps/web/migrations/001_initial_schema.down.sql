-- TripGenie Initial Schema Rollback
-- Migration: 001_initial_schema.down.sql

-- Drop triggers first
DROP TRIGGER IF EXISTS update_preferences_updated_at ON preferences;
DROP TRIGGER IF EXISTS update_itineraries_updated_at ON itineraries;
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS preferences;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS users;

-- Drop custom types
DROP TYPE IF EXISTS travel_style;
DROP TYPE IF EXISTS trip_status;
