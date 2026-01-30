-- NBU Dashboard Database Schema
-- Run this in the Supabase SQL Editor to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dashboards table (stores main metrics per upload)
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_name TEXT NOT NULL,
  freight_booking DECIMAL,
  gm2_percent DECIMAL,
  pbt_percent DECIMAL,
  otd_percent DECIMAL,
  ifd_percent DECIMAL,
  lhc_advance DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI Data table (stores detailed KPI records)
CREATE TABLE IF NOT EXISTS kpi_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  kpi TEXT,
  uom TEXT,
  fy25_budget DECIMAL,
  fy25_actual DECIMAL,
  variance DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery KPI table (stores OTD and IFD data)
CREATE TABLE IF NOT EXISTS delivery_kpi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  plan DECIMAL,
  actual DECIMAL,
  variance DECIMAL,
  kpi_type TEXT, -- 'OTD' or 'IFD'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Concerns table (stores concern items)
CREATE TABLE IF NOT EXISTS concerns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  priority TEXT, -- 'critical' or 'warning'
  region TEXT,
  area TEXT,
  kpi TEXT,
  actual TEXT,
  target TEXT,
  gap TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kpi_data_dashboard_id ON kpi_data(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_dashboard_id ON delivery_kpi(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_type ON delivery_kpi(kpi_type);
CREATE INDEX IF NOT EXISTS idx_concerns_dashboard_id ON concerns(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at DESC);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE kpi_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE delivery_kpi ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE concerns ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for development)
-- For production, you should create more restrictive policies
