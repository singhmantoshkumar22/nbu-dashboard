-- NBU Dashboard Database Schema v2 - Weekly Time Series Support
-- Run this in the Supabase SQL Editor to add weekly data support

-- Add latest_week column to dashboards table
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS latest_week INTEGER DEFAULT 0;

-- Weekly Delivery KPI table (stores OTD/IFD data per week)
CREATE TABLE IF NOT EXISTS delivery_kpi_weekly (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  kpi_type TEXT, -- 'OTD' or 'IFD'
  week_number INTEGER, -- 1 to 52
  plan DECIMAL,
  actual DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_weekly_dashboard ON delivery_kpi_weekly(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_weekly_type ON delivery_kpi_weekly(kpi_type);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_weekly_week ON delivery_kpi_weekly(week_number);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_weekly_area ON delivery_kpi_weekly(area);

-- Weekly KPI data table (stores Freight Booking, GM2%, PBT%, LHC Advance weekly data)
CREATE TABLE IF NOT EXISTS kpi_weekly (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  kpi TEXT, -- 'Freight Booking', 'GM2% on Sale', 'EstimatedPBT%', 'LHC Advance %'
  week_number INTEGER,
  planned DECIMAL,
  actual DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_weekly_dashboard ON kpi_weekly(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_kpi_weekly_kpi ON kpi_weekly(kpi);
CREATE INDEX IF NOT EXISTS idx_kpi_weekly_week ON kpi_weekly(week_number);
