-- TripGenie Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Created: 2026-02-03

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
-- Stores user account information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups during authentication
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- Trips Table
-- ============================================
-- Stores trip planning information
CREATE TYPE trip_status AS ENUM (
    'draft',
    'planning',
    'booked',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination VARCHAR(500) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget DECIMAL(12, 2),
    status trip_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure end date is after start date
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Index for user's trips lookups
CREATE INDEX idx_trips_user_id ON trips(user_id);
-- Index for filtering by status
CREATE INDEX idx_trips_status ON trips(status);
-- Index for date range queries
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);

-- ============================================
-- Itineraries Table
-- ============================================
-- Stores daily itinerary information for each trip
CREATE TABLE itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Each trip can only have one itinerary per day number
    CONSTRAINT unique_trip_day UNIQUE (trip_id, day_number),
    -- Day numbers must be positive
    CONSTRAINT positive_day_number CHECK (day_number > 0)
);

-- Index for trip itinerary lookups
CREATE INDEX idx_itineraries_trip_id ON itineraries(trip_id);

-- ============================================
-- User Preferences Table
-- ============================================
-- Stores user travel preferences for AI-powered recommendations
CREATE TYPE travel_style AS ENUM (
    'budget',
    'mid_range',
    'luxury',
    'backpacker',
    'business'
);

CREATE TABLE preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    interests TEXT[] DEFAULT '{}',
    travel_style travel_style,
    dietary_restrictions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for user preferences lookup
CREATE INDEX idx_preferences_user_id ON preferences(user_id);

-- ============================================
-- Updated At Trigger Function
-- ============================================
-- Automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itineraries_updated_at
    BEFORE UPDATE ON itineraries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
    BEFORE UPDATE ON preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE users IS 'User accounts for TripGenie application';
COMMENT ON TABLE trips IS 'Travel trips created by users';
COMMENT ON TABLE itineraries IS 'Daily itineraries for each trip';
COMMENT ON TABLE preferences IS 'User travel preferences for AI recommendations';

COMMENT ON COLUMN trips.budget IS 'Trip budget in user currency (stored as decimal)';
COMMENT ON COLUMN itineraries.activities IS 'JSON array of daily activities with time, title, description, etc.';
COMMENT ON COLUMN preferences.interests IS 'Array of user interests (e.g., hiking, museums, food)';
